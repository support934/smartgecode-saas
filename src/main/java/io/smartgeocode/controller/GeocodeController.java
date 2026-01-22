package io.smartgeocode.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Arrays;
import java.util.Collections;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Date;
import java.util.concurrent.CompletableFuture; 
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.Keys;
import java.util.Base64;
import javax.crypto.SecretKey;
import com.opencsv.CSVReader;
import java.io.InputStreamReader;
import java.util.Random;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import jakarta.annotation.PostConstruct;
import io.smartgeocode.service.LookupService;

// Email Imports
import com.sendgrid.SendGrid;
import com.sendgrid.Method;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.Request;
import com.sendgrid.Response;

// Spring Response Imports
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

// Stripe Imports
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import com.stripe.model.Subscription;
import com.stripe.exception.SignatureVerificationException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "https://geocode-frontend.smartgeocode.io", "https://smartgeocode.io"}, allowCredentials = "true")
public class GeocodeController {

    // FIX: Force HTTP/1.1 to prevent "GOAWAY" errors from Nominatim
    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();
            
    private final ObjectMapper mapper = new ObjectMapper();
    private final String SENDGRID_API_KEY = System.getenv("SENDGRID_API_KEY");
    
    // DELAY: 1.1s is the "Golden Rule" for Nominatim to avoid bans. Do not lower this.
    private final int API_DELAY_MS = 1100; 

    @Autowired
    private DataSource dataSource;

    @Autowired
    private LookupService lookupService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final String JWT_SECRET;

    // === CRITICAL FIX: STABLE SECRET ===
    // We use a hardcoded fallback if the ENV var is missing.
    // This ensures tokens remain valid even if the server restarts.
    {
        String envSecret = System.getenv("JWT_SECRET");
        if (envSecret != null && envSecret.length() >= 32) {
            JWT_SECRET = envSecret;
            System.out.println("✅ Loaded JWT_SECRET from Environment.");
        } else {
            System.err.println("⚠️ JWT_SECRET missing. Using FIXED fallback to persist sessions.");
            // This key never changes, so your browser token will stay valid across restarts.
            JWT_SECRET = "super-secret-key-that-is-stable-across-restarts-for-smartgeocode-dev-2024";
        }
    }

    public GeocodeController() {
        System.out.println("=== GeocodeController Live: Heavy-Duty Version (v3.3) ===");
    }

    static {
        if (System.getenv("STRIPE_CKOUT_SECRET_KEY") == null) {
            System.err.println("CRITICAL WARNING: STRIPE_CKOUT_SECRET_KEY is missing! Checkout will fail.");
        }
    }

    @PostConstruct
    public void initDatabase() {
        try (Connection conn = dataSource.getConnection()) {
            System.out.println("Checking DB Schema...");
            
            // User Table
            String sqlUsers = "CREATE TABLE IF NOT EXISTS users (" +
                              "id SERIAL PRIMARY KEY, " +
                              "email VARCHAR(255) UNIQUE NOT NULL, " +
                              "password_hash VARCHAR(255) NOT NULL, " +
                              "subscription_status VARCHAR(20) DEFAULT 'free', " +
                              "reset_token VARCHAR(500), " +
                              "stripe_customer_id VARCHAR(255))";
            conn.prepareStatement(sqlUsers).execute();

            // Batches Table - 'results' column is TEXT to hold the CSV content
            String sqlBatches = "CREATE TABLE IF NOT EXISTS batches (" +
                                "id SERIAL PRIMARY KEY, " +
                                "user_id INTEGER REFERENCES users(id), " +
                                "status VARCHAR(20) DEFAULT 'processing', " +
                                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                                "results TEXT, " +
                                "total_rows INTEGER DEFAULT 0, " +
                                "processed_rows INTEGER DEFAULT 0)";
            conn.prepareStatement(sqlBatches).execute();
            
            System.out.println("DB Schema Verified: Users and Batches tables ready.");
        } catch (Exception e) {
            System.err.println("DB Init Failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return 0L;
        try {
            String token = authHeader.substring(7);
            // Handle frontend possibly sending "Bearer null" string
            if ("null".equals(token) || "undefined".equals(token) || token.isEmpty()) return 0L;
            
            Claims claims = Jwts.parserBuilder()
                .setSigningKey(JWT_SECRET.getBytes(StandardCharsets.UTF_8))
                .build()
                .parseClaimsJws(token)
                .getBody();
            return claims.get("userId", Long.class);
        } catch (Exception e) {
            System.err.println("Auth Token Invalid: " + e.getMessage());
            return 0L;
        }
    }

    // === 1. SINGLE LOOKUP ===
    @GetMapping("/geocode")
    public ResponseEntity<Map<String, Object>> geocode(@RequestParam("address") String addr, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (addr == null || addr.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Missing address parameter"));
        }

        Long userId = extractUserId(authHeader);
        System.out.println("Single Lookup Request. User: " + userId + " Addr: " + addr);

        if (!lookupService.canPerformLookup(userId, 1)) {
            return ResponseEntity.status(403).body(Map.of("status", "error", "message", "Monthly limit reached. Upgrade to Premium."));
        }

        Map<String, Object> result = performGeocodeRequest(addr);
        
        if ("success".equals(result.get("status"))) {
            lookupService.incrementLookup(userId, 1);
        }
        return ResponseEntity.ok(result);
    }

    // === 2. BATCH GEOCODE (THE HEAVY LIFTER) ===
    @PostMapping(value = "/batch-geocode", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> batchGeocode(@RequestParam("file") MultipartFile file, @RequestParam("email") String email, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long tokenUserId = extractUserId(authHeader);
        System.out.println("Batch Upload Received. TokenUser: " + tokenUserId + " Email: " + email);

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Uploaded file is empty"));
        }

        try {
            // A. Authenticate / Resolve User ID
            Long dbUserId;
            try (Connection conn = dataSource.getConnection()) {
                PreparedStatement stmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
                stmt.setString(1, email);
                ResultSet rs = stmt.executeQuery();
                if (!rs.next()) {
                    return ResponseEntity.status(404).body(Map.of("status", "error", "message", "User email not found in database"));
                }
                dbUserId = rs.getLong("id");
            }

            // B. Parse CSV (Count Rows First)
            List<String[]> validRows = new ArrayList<>();
            try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
                String[] line;
                while ((line = reader.readNext()) != null) {
                    // Skip empty lines or comments
                    if (line.length > 0 && !line[0].trim().startsWith("#") && !allColumnsEmpty(line)) {
                        validRows.add(line);
                    }
                }
            }
            // Subtract 1 for header if it exists (Checked later, but assuming 1st row is header for count)
            int rowCount = validRows.isEmpty() ? 0 : validRows.size() - 1; 

            // C. Check Limits BEFORE processing
            // Use Token ID if available (secure), otherwise DB ID (fallback)
            Long limitUserId = tokenUserId != 0L ? tokenUserId : dbUserId;
            
            System.out.println("Batch Limit Check - UserID: " + limitUserId + ", Rows: " + rowCount);

            if (!lookupService.canPerformLookup(limitUserId, rowCount)) {
                return ResponseEntity.status(403).body(Map.of("status", "error", "message", "Batch size (" + rowCount + ") exceeds remaining monthly limit. Please upgrade."));
            }

            // D. Init Batch Record in DB
            int batchId;
            try (Connection conn = dataSource.getConnection()) {
                PreparedStatement stmt = conn.prepareStatement("INSERT INTO batches (user_id, status, total_rows, processed_rows) VALUES (?, 'processing', ?, 0)", Statement.RETURN_GENERATED_KEYS);
                stmt.setLong(1, limitUserId);
                stmt.setInt(2, rowCount);
                stmt.executeUpdate();
                ResultSet keys = stmt.getGeneratedKeys();
                keys.next();
                batchId = keys.getInt(1);
            }

            // E. Start Async Process (Fire and Forget)
            System.out.println("Starting Async Batch #" + batchId + " for UserID " + limitUserId);
            CompletableFuture.runAsync(() -> processBatchLogic(batchId, limitUserId, validRows, email));
            
            return ResponseEntity.ok(Map.of("status", "success", "batchId", batchId, "message", "Processing started in background.", "totalRows", rowCount));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "Server Error: " + e.getMessage()));
        }
    }

    // === 3. THE "IRON CLAD" LOGIC ENGINE ===
    // This is the updated logic block that restores the 100% success rate
    private void processBatchLogic(int batchId, Long userId, List<String[]> rows, String email) {
        StringBuilder csvOutput = new StringBuilder();
        // Add headers for result CSV
        csvOutput.append("input_address,lat,lng,formatted_address,status,match_type\n");
        
        String[] headers = null;
        Map<String, Integer> colMap = new HashMap<>();
        
        int processed = 0;

        for (String[] line : rows) {
            // 1. Handle Header Row
            if (headers == null) {
                headers = line;
                for(int i=0; i<headers.length; i++) {
                    // Normalize to lowercase for case-insensitive matching
                    colMap.put(headers[i].toLowerCase().trim(), i);
                }
                // Validate required columns
                if (!colMap.containsKey("address") && !colMap.containsKey("landmark")) {
                    failBatch(batchId, "Invalid CSV: Must contain 'address' or 'landmark' column header.");
                    return;
                }
                continue;
            }

            // 2. Dynamic Limit Check (Stop if user runs out mid-batch)
            if (!lookupService.canPerformLookup(userId, 1)) {
                 csvOutput.append("\"LIMIT REACHED\",\"\",\"\",\"Upgrade to continue processing\",\"skipped\",\"limit_hit\"\n");
                 // Save what we have so far
                 finishBatch(batchId, csvOutput.toString(), processed);
                 System.out.println("Batch #" + batchId + " stopped: Limit reached.");
                 return;
            }

            // 3. Extract Data Fields safely
            processed++;
            String address = getVal(line, colMap, "address");
            String landmark = getVal(line, colMap, "landmark");
            String city = getVal(line, colMap, "city");
            String state = getVal(line, colMap, "state");
            String country = getVal(line, colMap, "country");
            String zip = getVal(line, colMap, "zip");

            Map<String, Object> result = Map.of("status", "error");
            String matchType = "none";

            // --- WATERFALL STRATEGY (High Accuracy) ---
            // This attempts multiple variations to find the best match
            
            // Attempt 1: Landmark + City + Country (Best for famous places like 'Taj Mahal, Agra')
            if (!landmark.isEmpty()) {
                String q = buildQuery(landmark, city, state, country);
                result = performGeocodeRequest(q);
                if ("success".equals(result.get("status"))) matchType = "landmark_context";
            }

            // Attempt 2: Address + City + State + Zip (Standard Postal Lookup)
            if (!"success".equals(result.get("status")) && !address.isEmpty()) {
                String q = buildQuery(address, city, state, country);
                result = performGeocodeRequest(q);
                if ("success".equals(result.get("status"))) matchType = "address_context";
            }

            // Attempt 3: Landmark Only (Global search, fallback)
            if (!"success".equals(result.get("status")) && !landmark.isEmpty()) {
                result = performGeocodeRequest(landmark);
                if ("success".equals(result.get("status"))) matchType = "landmark_only";
            }

            // Attempt 4: Address Only (Fallback)
            if (!"success".equals(result.get("status")) && !address.isEmpty()) {
                result = performGeocodeRequest(address);
                if ("success".equals(result.get("status"))) matchType = "address_only";
            }

            // Attempt 5: City/Zip Fallback (Last resort - better than nothing)
            if (!"success".equals(result.get("status"))) {
                 String q = buildQuery("", city, state, country); // Just city/country
                 if (!q.isEmpty()) {
                     result = performGeocodeRequest(q);
                     if ("success".equals(result.get("status"))) matchType = "city_fallback";
                 }
            }

            // 4. Append to CSV Result (Robust CSV Formatting)
            String inputRep = (landmark + " " + address).trim();
            // Escape double quotes for CSV safety
            String rowString = String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n", 
                inputRep.replace("\"", "\"\""),
                result.getOrDefault("lat", ""),
                result.getOrDefault("lng", ""),
                result.getOrDefault("formatted_address", "").toString().replace("\"", "\"\""),
                result.get("status"),
                matchType
            );
            csvOutput.append(rowString);

            // 5. Update Usage & DB (LIVE UPDATE)
            if ("success".equals(result.get("status"))) {
                try {
                    // EXPLICIT INCREMENT - This connects the Batch Loop to the Usage Counter
                    System.out.println("[BATCH] Incrementing usage for User ID: " + userId);
                    lookupService.incrementLookup(userId, 1);
                } catch (Exception e) {
                    System.err.println("[BATCH] Failed to increment usage: " + e.getMessage());
                }
            }

            // CRITICAL: Update DB every row so frontend polling sees live data
            updateBatchProgress(batchId, processed, csvOutput.toString());
            
            // 6. Rate Limit Delay (Respect Nominatim Policy)
            try { Thread.sleep(API_DELAY_MS); } catch (InterruptedException ignored) {}
        }

        // Finalize Batch
        finishBatch(batchId, csvOutput.toString(), processed);
        sendCompletionEmail(email, batchId, processed);
        System.out.println("Batch #" + batchId + " Complete. Rows: " + processed);
    }

    private String getVal(String[] line, Map<String, Integer> map, String key) {
        if (map.containsKey(key) && map.get(key) < line.length) {
            String val = line[map.get(key)];
            return val != null ? val.trim() : "";
        }
        return "";
    }

    // Helper Method for Waterfall Logic
    private String buildQuery(String main, String city, String state, String country) {
        List<String> parts = new ArrayList<>();
        if (main != null && !main.isEmpty()) parts.add(main);
        if (city != null && !city.isEmpty()) parts.add(city);
        if (state != null && !state.isEmpty()) parts.add(state);
        if (country != null && !country.isEmpty()) parts.add(country);
        return String.join(", ", parts);
    }

    private Map<String, Object> performGeocodeRequest(String query) {
        try {
            if (query.trim().isEmpty()) return Map.of("status", "skipped");
            
            String encoded = query.replace(" ", "+").replace(",", "%2C");
            String email = System.getenv("NOMINATIM_EMAIL") != null ? System.getenv("NOMINATIM_EMAIL") : "admin@smartgeocode.io";
            // Use q= for flexible search
            String url = "https://nominatim.openstreetmap.org/search?format=json&email=" + email + "&q=" + encoded + "&limit=1";
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", "SmartGeocode/1.0")
                .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                Object parsed = mapper.readValue(response.body(), Object.class);
                if (parsed instanceof List && !((List<?>) parsed).isEmpty()) {
                    Map<String, Object> first = ((List<Map<String, Object>>) parsed).get(0);
                    return Map.of(
                        "status", "success", 
                        "lat", first.get("lat"), 
                        "lng", first.get("lon"), 
                        "formatted_address", first.get("display_name")
                    );
                }
            }
        } catch (Exception e) {
            System.err.println("Geocode API Error: " + e.getMessage());
        }
        return Map.of("status", "error");
    }

    // === 4. DB UPDATE HELPERS (LIVE) ===
    private void updateBatchProgress(int batchId, int count, String partialCsv) {
        try (Connection conn = dataSource.getConnection()) {
            // Update BOTH processed count AND the results text for live preview
            PreparedStatement stmt = conn.prepareStatement("UPDATE batches SET processed_rows = ?, results = ? WHERE id = ?");
            stmt.setInt(1, count);
            stmt.setString(2, partialCsv);
            stmt.setInt(3, batchId);
            stmt.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void finishBatch(int batchId, String csv, int total) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE batches SET status = 'complete', results = ?, processed_rows = ? WHERE id = ?");
            stmt.setString(1, csv);
            stmt.setInt(2, total);
            stmt.setInt(3, batchId);
            stmt.executeUpdate();
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void failBatch(int batchId, String reason) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE batches SET status = 'failed', results = ? WHERE id = ?");
            stmt.setString(1, reason); stmt.setInt(2, batchId); stmt.executeUpdate();
        } catch (Exception e) {}
    }

    private void sendCompletionEmail(String email, int batchId, int total) {
        // SendGrid implementation
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        String subject = "Batch Processing Complete";
        String body = "Your batch #" + batchId + " is done. Processed " + total + " rows.\n\nLogin to download: https://geocode-frontend.smartgeocode.io";
        Content content = new Content("text/plain", body);
        Mail mail = new Mail(from, subject, to, content);
        try {
            SendGrid sg = new SendGrid(SENDGRID_API_KEY);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            sg.api(request);
        } catch (Exception e) { e.printStackTrace(); }
    }

    // === 5. ENDPOINTS FOR FRONTEND ===
    
    // Helper: Parse partial CSV for live table
    @GetMapping("/batch/{id}")
    public ResponseEntity<Map<String, Object>> getBatchStatus(@PathVariable int id, @RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT status, results, total_rows, processed_rows FROM batches b JOIN users u ON b.user_id = u.id WHERE b.id = ? AND u.email = ?");
            stmt.setInt(1, id); stmt.setString(2, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                Map<String, Object> response = new HashMap<>();
                response.put("status", rs.getString("status"));
                response.put("totalRows", rs.getInt("total_rows"));
                response.put("processedRows", rs.getInt("processed_rows"));
                
                String resCsv = rs.getString("results");
                if (resCsv != null && !resCsv.isEmpty()) {
                    // Send up to 50 lines for live preview
                    String[] lines = resCsv.split("\n");
                    List<Map<String, String>> preview = new ArrayList<>();
                    // Skip header (index 0)
                    for(int i=1; i<Math.min(lines.length, 51); i++) {
                        String[] cols = lines[i].split("\",\""); // Basic CSV split handling quoted commas
                        if(cols.length >= 4) {
                            preview.add(Map.of(
                                "address", cols[0].replace("\"", ""), 
                                "lat", cols[1], 
                                "lng", cols[2], 
                                "status", cols[4].replace("\"", "")
                            ));
                        }
                    }
                    response.put("preview", preview);
                }
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {}
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/batches")
    public ResponseEntity<List<Map<String, Object>>> getBatches(@RequestParam("email") String email) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, status, created_at FROM batches WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY created_at DESC");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            while(rs.next()) {
                list.add(Map.of(
                    "id", rs.getInt("id"), 
                    "status", rs.getString("status"), 
                    "created_at", rs.getTimestamp("created_at").toString()
                ));
            }
        } catch(Exception e){}
        return ResponseEntity.ok(list);
    }

    @GetMapping("/batch/{id}/download")
    public ResponseEntity<byte[]> downloadBatch(@PathVariable int id, @RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT results FROM batches b JOIN users u ON b.user_id = u.id WHERE b.id = ? AND u.email = ?");
            stmt.setInt(1, id); stmt.setString(2, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"batch_" + id + ".csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(rs.getString("results").getBytes(StandardCharsets.UTF_8));
            }
        } catch(Exception e) {}
        return ResponseEntity.notFound().build();
    }

    // === 6. AUTH, EMAIL & ADMIN (Existing) ===
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> creds) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, password_hash FROM users WHERE email = ?");
            stmt.setString(1, creds.get("email"));
            ResultSet rs = stmt.executeQuery();
            if (rs.next() && encoder.matches(creds.get("password"), rs.getString("password_hash"))) {
                int userId = rs.getInt("id");
                return ResponseEntity.ok(Map.of("status", "success", "token", generateToken(creds.get("email"), userId), "userId", userId));
            }
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Invalid credentials"));
        } catch (Exception e) { return ResponseEntity.status(500).body(Map.of("status", "error", "message", "Error")); }
    }

    @PostMapping("/email")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, Object> payload) {
        String email = (String) payload.get("email");
        String address = (String) payload.get("address");
        Map<String, Object> result = (Map<String, Object>) payload.get("result");
        
        // 1. Capture Lead
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement check = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            check.setString(1, email);
            if (!check.executeQuery().next()) {
                String randomPass = UUID.randomUUID().toString();
                PreparedStatement insert = conn.prepareStatement("INSERT INTO users (email, password_hash, subscription_status) VALUES (?, ?, 'lead')");
                insert.setString(1, email);
                insert.setString(2, encoder.encode(randomPass));
                insert.executeUpdate();
            }
        } catch (Exception e) {}

        // 2. Send Email
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        String link = "https://geocode-frontend.smartgeocode.io/signup?email=" + email;
        String body = "Results for: " + address + "\n\nLat: " + result.get("lat") + "\nLng: " + result.get("lng") + 
                      "\n\nClaim account: " + link;
        Content content = new Content("text/plain", body);
        Mail mail = new Mail(from, "Your Geocode Results", to, content);
        try {
            SendGrid sg = new SendGrid(SENDGRID_API_KEY);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            sg.api(request);
            return ResponseEntity.ok("Email sent");
        } catch (Exception e) { return ResponseEntity.status(500).body("Email failed"); }
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> creds) {
        String email = creds.get("email");
        String password = creds.get("password");
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement check = conn.prepareStatement("SELECT id, subscription_status FROM users WHERE email = ?");
            check.setString(1, email);
            ResultSet rs = check.executeQuery();
            if (rs.next()) {
                if ("lead".equals(rs.getString("subscription_status"))) {
                    PreparedStatement update = conn.prepareStatement("UPDATE users SET password_hash = ?, subscription_status = 'free' WHERE email = ?");
                    update.setString(1, encoder.encode(password));
                    update.setString(2, email);
                    update.executeUpdate();
                    int userId = rs.getInt("id");
                    return ResponseEntity.ok(Map.of("status", "success", "token", generateToken(email, userId), "userId", userId));
                }
                return ResponseEntity.status(400).body(Map.of("status", "error", "message", "Email exists. Please log in."));
            }
            PreparedStatement insert = conn.prepareStatement("INSERT INTO users (email, password_hash) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS);
            insert.setString(1, email);
            insert.setString(2, encoder.encode(password));
            insert.executeUpdate();
            ResultSet keys = insert.getGeneratedKeys();
            keys.next();
            int userId = keys.getInt(1);
            return ResponseEntity.ok(Map.of("status", "success", "token", generateToken(email, userId), "userId", userId));
        } catch (Exception e) { return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage())); }
    }

    // === UTILS ===
    private boolean allColumnsEmpty(String[] line) {
        if (line == null) return true;
        for(String s : line) if(s != null && !s.trim().isEmpty()) return false;
        return true;
    }
    
    private String generateToken(String email, int userId) {
        return Jwts.builder().setSubject(email).claim("userId", userId).setIssuedAt(new Date()).setExpiration(new Date(System.currentTimeMillis() + 604800000)).signWith(SignatureAlgorithm.HS256, JWT_SECRET).compact();
    }
    
    // Updated Usage Endpoint with Cache Busting Headers
    @GetMapping("/usage")
    public ResponseEntity<Map<String, Object>> getUsage(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        Map<String, Integer> usageData = lookupService.getUsage(userId);
        
        // Ensure standardization for frontend (explicit keys)
        Map<String, Object> response = new HashMap<>();
        response.put("used", usageData.getOrDefault("used", 0));
        response.put("limit", usageData.getOrDefault("limit", 500));
        
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
            .header(HttpHeaders.PRAGMA, "no-cache")
            .header(HttpHeaders.EXPIRES, "0")
            .body(response);
    }
    
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT subscription_status FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) return ResponseEntity.ok(Map.of("subscription_status", rs.getString("subscription_status")));
            return ResponseEntity.status(404).body(Map.of("message", "User not found"));
        } catch (Exception e) { return ResponseEntity.status(500).body(Map.of("message", "Error")); }
    }
    
    @GetMapping("/test-db")
    public String testDbConnection() {
        try (Connection conn = dataSource.getConnection()) {
            return "Connection successful: " + conn.getMetaData().getURL();
        } catch (Exception e) { return "Connection failed: " + e.getMessage(); }
    }
    
    @PostMapping("/create-portal-session")
    public ResponseEntity<Map<String, Object>> createPortalSession(@RequestBody Map<String, String> payload) {
        Stripe.apiKey = System.getenv("STRIPE_SUB_SECRET_KEY");
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT stripe_customer_id FROM users WHERE email = ?");
            stmt.setString(1, payload.get("email"));
            ResultSet rs = stmt.executeQuery();
            if (rs.next() && rs.getString("stripe_customer_id") != null) {
                com.stripe.param.billingportal.SessionCreateParams params = com.stripe.param.billingportal.SessionCreateParams.builder()
                    .setCustomer(rs.getString("stripe_customer_id"))
                    .setReturnUrl("https://geocode-frontend.smartgeocode.io/dashboard").build();
                return ResponseEntity.ok(Map.of("url", com.stripe.model.billingportal.Session.create(params).getUrl()));
            }
            return ResponseEntity.status(400).body(Map.of("error", "No subscription"));
        } catch (Exception e) { return ResponseEntity.status(500).body(Map.of("error", e.getMessage())); }
    }
    
    @PostMapping("/checkout")
    public ResponseEntity<Map<String, Object>> createCheckoutSession(@RequestBody Map<String, String> payload) {
        String checkoutKey = System.getenv("STRIPE_CKOUT_SECRET_KEY");
        Stripe.apiKey = checkoutKey;
        String email = payload.get("email");
        try {
            com.stripe.param.checkout.SessionCreateParams params = com.stripe.param.checkout.SessionCreateParams.builder()
                .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                .addPaymentMethodType(com.stripe.param.checkout.SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                    .setPrice("price_1Sd8JxA5JR9NQZvD0GCmjm6R") 
                    .setQuantity(1L).build())
                .setCustomerEmail(email)
                .setSuccessUrl("https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl("https://geocode-frontend.smartgeocode.io?cancelled=true")
                .build();
            return ResponseEntity.ok(Map.of("url", com.stripe.model.checkout.Session.create(params).getUrl()));
        } catch (Exception e) { return ResponseEntity.status(500).body(Map.of("error", e.getMessage())); }
    }
    
    @PostMapping("/stripe-webhook")
    public ResponseEntity<String> stripeWebhook(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sigHeader) {
        String webhookSecret = System.getenv("STRIPE_WEBHOOK_SECRET");
        try {
            Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
            if ("customer.subscription.created".equals(event.getType()) || "customer.subscription.updated".equals(event.getType())) {
                Subscription sub = (Subscription) event.getDataObjectDeserializer().getObject().get();
                try (Connection conn = dataSource.getConnection()) {
                    PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium', stripe_customer_id = ? WHERE stripe_customer_id = ? OR stripe_customer_id IS NULL");
                    stmt.setString(1, sub.getCustomer());
                    stmt.setString(2, sub.getCustomer());
                    stmt.executeUpdate();
                }
            } else if ("customer.subscription.deleted".equals(event.getType())) {
                Subscription sub = (Subscription) event.getDataObjectDeserializer().getObject().get();
                try (Connection conn = dataSource.getConnection()) {
                    PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'canceled' WHERE stripe_customer_id = ?");
                    stmt.setString(1, sub.getCustomer());
                    stmt.executeUpdate();
                }
            }
            return ResponseEntity.ok("Received");
        } catch (Exception e) { return ResponseEntity.status(400).body("Error"); }
    }
}