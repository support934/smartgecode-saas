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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Date;
import java.util.concurrent.CompletableFuture; // REQUIRED FOR ASYNC
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

import com.sendgrid.SendGrid;
import com.sendgrid.Method;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.Request;
import com.sendgrid.Response;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import com.stripe.model.Subscription;
import com.stripe.exception.SignatureVerificationException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "https://geocode-frontend.smartgeocode.io", "*"})
public class GeocodeController {

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String SENDGRID_API_KEY = System.getenv("SENDGRID_API_KEY");

    // === CONFIGURATION ===
    // 1000ms delay = 1 request/sec. Prevents IP Ban from Nominatim.
    private final int API_DELAY_MS = 1000; 

    @Autowired
    private DataSource dataSource;

    @Autowired
    private LookupService lookupService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final String JWT_SECRET;

    {
        String envSecret = System.getenv("JWT_SECRET");
        if (envSecret != null && envSecret.length() >= 32) {
            JWT_SECRET = envSecret;
        } else {
            SecretKey key = Keys.secretKeyFor(SignatureAlgorithm.HS256);
            JWT_SECRET = Base64.getEncoder().encodeToString(key.getEncoded());
            System.out.println("Generated secure JWT_SECRET for local testing: " + JWT_SECRET);
        }
    }

    public GeocodeController() {
        System.out.println("=== GeocodeController Instantiated (Full Feature Set) ===");
    }

    static {
        if (System.getenv("STRIPE_CKOUT_SECRET_KEY") == null) {
            System.err.println("WARNING: STRIPE_CKOUT_SECRET_KEY missing. Payments will fail.");
        }
    }

    @PostConstruct
    public void initDatabase() {
        try (Connection conn = dataSource.getConnection()) {
            System.out.println("DB Connected. Ensuring schema...");
            
            // 1. Users Table
            String sqlUsers = "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, subscription_status VARCHAR(20) DEFAULT 'free', reset_token VARCHAR(500), stripe_customer_id VARCHAR(255))";
            conn.prepareStatement(sqlUsers).execute();

            // 2. Batches Table (Updated with progress columns for the new Async system)
            String sqlBatches = "CREATE TABLE IF NOT EXISTS batches (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), status VARCHAR(20) DEFAULT 'processing', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, results TEXT, total_rows INTEGER DEFAULT 0, processed_rows INTEGER DEFAULT 0)";
            conn.prepareStatement(sqlBatches).execute();
            
            System.out.println("Schema check complete.");
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("DB Init Failed: " + e.getMessage());
        }
    }

    // === LANDING REDIRECT ===
    @GetMapping("/")
    public RedirectView landing() {
        // Sends root traffic to the frontend app
        return new RedirectView("https://geocode-frontend.smartgeocode.io");
    }

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return 0L;
        try {
            Claims claims = Jwts.parserBuilder()
                .setSigningKey(JWT_SECRET.getBytes(StandardCharsets.UTF_8))
                .build()
                .parseClaimsJws(authHeader.substring(7))
                .getBody();
            return claims.get("userId", Long.class);
        } catch (Exception e) {
            return 0L;
        }
    }

    // === AUTH ENDPOINTS (Signup, Login, Forgot PW, Reset PW) ===

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        if (email == null || password == null) return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Missing email/password"));

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement check = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            check.setString(1, email);
            if (check.executeQuery().next()) return ResponseEntity.status(400).body(Map.of("status", "error", "message", "Email exists"));

            PreparedStatement insert = conn.prepareStatement("INSERT INTO users (email, password_hash) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS);
            insert.setString(1, email);
            insert.setString(2, encoder.encode(password));
            insert.executeUpdate();
            ResultSet keys = insert.getGeneratedKeys();
            
            if (keys.next()) {
                int userId = keys.getInt(1);
                String token = generateToken(email, userId);
                return ResponseEntity.ok(Map.of("status", "success", "token", token, "userId", userId));
            }
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "Signup failed"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, password_hash FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next() && encoder.matches(password, rs.getString("password_hash"))) {
                int userId = rs.getInt("id");
                String token = generateToken(email, userId);
                return ResponseEntity.ok(Map.of("status", "success", "token", token, "userId", userId));
            }
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Invalid credentials"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "Login error"));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null) return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Missing email"));

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            stmt.setString(1, email);
            if (!stmt.executeQuery().next()) return ResponseEntity.status(404).body(Map.of("status", "error", "message", "Email not found"));

            String token = UUID.randomUUID().toString();
            PreparedStatement update = conn.prepareStatement("UPDATE users SET reset_token = ? WHERE email = ?");
            update.setString(1, token);
            update.setString(2, email);
            update.executeUpdate();

            sendResetEmail(email, token);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Reset link sent"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "System error"));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        String newPassword = request.get("password");
        if (token == null || newPassword == null) return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Missing token/password"));

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT email FROM users WHERE reset_token = ?");
            stmt.setString(1, token);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                String email = rs.getString("email");
                PreparedStatement update = conn.prepareStatement("UPDATE users SET password_hash = ?, reset_token = NULL WHERE email = ?");
                update.setString(1, encoder.encode(newPassword));
                update.setString(2, email);
                update.executeUpdate();
                return ResponseEntity.ok(Map.of("status", "success", "message", "Password updated"));
            }
            return ResponseEntity.status(400).body(Map.of("status", "error", "message", "Invalid token"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "System error"));
        }
    }

    private void sendResetEmail(String email, String token) {
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        Content content = new Content("text/html", "<h2>Reset Your Password</h2><p>Click <a href='https://geocode-frontend.smartgeocode.io/reset-password?token=" + token + "'>here</a> to reset. Expires soon.</p>");
        Mail mail = new Mail(from, "Password Reset", to, content);
        try {
            SendGrid sg = new SendGrid(SENDGRID_API_KEY);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            sg.api(request);
        } catch (Exception e) {
            System.err.println("Email send failed: " + e.getMessage());
        }
    }

    private String generateToken(String email, int userId) {
        return Jwts.builder()
            .setSubject(email)
            .claim("userId", userId)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + 604800000)) // 7 days
            .signWith(SignatureAlgorithm.HS256, JWT_SECRET)
            .compact();
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT subscription_status FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) return ResponseEntity.ok(Map.of("subscription_status", rs.getString("subscription_status")));
            return ResponseEntity.status(404).body(Map.of("message", "User not found"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Error"));
        }
    }

    // === SINGLE GEOCODE ===

    @GetMapping("/geocode")
    public Map<String, Object> geocode(@RequestParam("address") String addr, @RequestParam(value = "addr", required = false) String addrFallback, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String finalAddr = addr != null ? addr : addrFallback;
        if (finalAddr == null || finalAddr.isEmpty()) return Map.of("status", "error", "message", "Missing address");

        Long userId = extractUserId(authHeader);
        if (!lookupService.canPerformLookup(userId, 1)) {
            return Map.of("status", "error", "message", "Monthly limit reached. Upgrade to Premium.");
        }

        Map<String, Object> result = performGeocodeRequest(finalAddr);
        if ("success".equals(result.get("status"))) {
            lookupService.incrementLookup(userId, 1);
        }
        return result;
    }

    private Map<String, Object> performGeocodeRequest(String address) {
        try {
            String encodedAddr = address.replace(" ", "+").replace(",", "%2C");
            String email = System.getenv("NOMINATIM_EMAIL") != null ? System.getenv("NOMINATIM_EMAIL") : "admin@smartgeocode.io";
            String url = "https://nominatim.openstreetmap.org/search?format=json&email=" + email + "&q=" + encodedAddr + "&limit=1";

            var request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "SmartGeocodeSaaS/1.0 (" + email + ")")
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) return Map.of("status", "error", "message", "Provider Error: " + response.statusCode());

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
            return Map.of("status", "error", "message", "Not found");
        } catch (Exception e) {
            return Map.of("status", "error", "message", "System Error");
        }
    }

    // === ASYNC BATCH GEOCODE (NEW LOGIC) ===

    @PostMapping(value = "/batch-geocode", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> batchGeocode(@RequestParam("file") MultipartFile file, @RequestParam("email") String email, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long tokenUserId = extractUserId(authHeader);
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Empty file"));

        try {
            // A. Validate User
            Long dbUserId;
            try (Connection conn = dataSource.getConnection()) {
                PreparedStatement stmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
                stmt.setString(1, email);
                ResultSet rs = stmt.executeQuery();
                if (!rs.next()) return ResponseEntity.status(404).body(Map.of("status", "error", "message", "User not found"));
                dbUserId = rs.getLong("id");
            }

            // B. Parse CSV to Memory
            List<String> validAddresses = new ArrayList<>();
            try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
                String[] line;
                String[] headers = null;
                int addrIdx = -1;
                while ((line = reader.readNext()) != null) {
                    if (line.length == 0 || (line[0] != null && line[0].startsWith("#"))) continue;
                    if (headers == null) {
                        headers = line;
                        for(int i=0; i<headers.length; i++) if(headers[i].toLowerCase().contains("address")) addrIdx = i;
                        if (addrIdx == -1) return ResponseEntity.badRequest().body(Map.of("status","error", "message", "Missing 'address' column"));
                        continue;
                    }
                    if (line.length > addrIdx && !line[addrIdx].trim().isEmpty()) {
                        validAddresses.add(line[addrIdx].trim());
                    }
                }
            }

            // C. Check Limits
            Long limitUserId = tokenUserId != 0L ? tokenUserId : dbUserId;
            if (!lookupService.canPerformLookup(limitUserId, validAddresses.size())) {
                return ResponseEntity.status(403).body(Map.of("status", "error", "message", "Batch exceeds monthly limit. Upgrade to Premium."));
            }

            // D. Create Batch Record
            int batchId;
            try (Connection conn = dataSource.getConnection()) {
                PreparedStatement stmt = conn.prepareStatement("INSERT INTO batches (user_id, status, total_rows, processed_rows) VALUES (?, 'processing', ?, 0)", Statement.RETURN_GENERATED_KEYS);
                stmt.setLong(1, dbUserId);
                stmt.setInt(2, validAddresses.size());
                stmt.executeUpdate();
                ResultSet keys = stmt.getGeneratedKeys();
                keys.next();
                batchId = keys.getInt(1);
            }

            // E. START ASYNC PROCESSING
            CompletableFuture.runAsync(() -> processBatchAsync(batchId, limitUserId, validAddresses));

            // F. Return Immediate Response
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "batchId", batchId,
                "message", "Processing started."
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    private void processBatchAsync(int batchId, Long userId, List<String> addresses) {
        List<String> resultsCsv = new ArrayList<>();
        resultsCsv.add("address,lat,lng,formatted_address,status");

        int processed = 0;
        for (String addr : addresses) {
            Map<String, Object> geo = performGeocodeRequest(addr);
            
            String row = String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"",
                addr,
                geo.getOrDefault("lat", ""),
                geo.getOrDefault("lng", ""),
                geo.getOrDefault("formatted_address", ""),
                geo.get("status")
            );
            resultsCsv.add(row);
            processed++;

            // Update Progress in DB every 5 rows
            if (processed % 5 == 0) updateBatchProgress(batchId, processed);
            
            if ("success".equals(geo.get("status"))) {
                lookupService.incrementLookup(userId, 1);
            }

            // THROTTLE
            try { Thread.sleep(API_DELAY_MS); } catch (InterruptedException ignored) {}
        }

        finishBatch(batchId, String.join("\n", resultsCsv));
    }

    private void updateBatchProgress(int batchId, int count) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE batches SET processed_rows = ? WHERE id = ?");
            stmt.setInt(1, count);
            stmt.setInt(2, batchId);
            stmt.executeUpdate();
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void finishBatch(int batchId, String csvContent) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE batches SET status = 'complete', results = ?, processed_rows = total_rows WHERE id = ?");
            stmt.setString(1, csvContent);
            stmt.setInt(2, batchId);
            stmt.executeUpdate();
        } catch (Exception e) { e.printStackTrace(); }
    }

    // === BATCH HISTORY & DOWNLOAD (Restored) ===

    @GetMapping("/batches")
    public ResponseEntity<List<Map<String, Object>>> getBatches(@RequestParam("email") String email) {
        List<Map<String, Object>> batches = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, status, created_at, total_rows, processed_rows FROM batches WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY created_at DESC");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> batch = new HashMap<>();
                batch.put("id", rs.getInt("id"));
                batch.put("status", rs.getString("status"));
                batch.put("created_at", rs.getTimestamp("created_at").toString());
                // Add progress info for list view
                batch.put("total_rows", rs.getInt("total_rows"));
                batch.put("processed_rows", rs.getInt("processed_rows"));
                batches.add(batch);
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(batches);
        }
        return ResponseEntity.ok(batches);
    }

    @GetMapping("/batch/{id}")
    public ResponseEntity<Map<String, Object>> getBatchStatus(@PathVariable int id, @RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement(
                "SELECT b.status, b.results, b.total_rows, b.processed_rows FROM batches b JOIN users u ON b.user_id = u.id WHERE b.id = ? AND u.email = ?"
            );
            stmt.setInt(1, id);
            stmt.setString(2, email);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                String status = rs.getString("status");
                int total = rs.getInt("total_rows");
                int processed = rs.getInt("processed_rows");
                
                Map<String, Object> response = new HashMap<>();
                response.put("status", status);
                response.put("progress", total == 0 ? 0 : (int)((double)processed / total * 100));
                
                if ("complete".equals(status)) {
                    String fullCsv = rs.getString("results");
                    if (fullCsv != null) {
                        String[] lines = fullCsv.split("\n");
                        List<String> preview = new ArrayList<>();
                        for(int i=0; i<Math.min(lines.length, 6); i++) preview.add(lines[i]);
                        response.put("preview", preview);
                    }
                    response.put("downloadUrl", "/api/batch/" + id + "/download?email=" + email);
                }
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(404).body(Map.of("status", "error", "message", "Batch not found"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("status", "error"));
        }
    }

    @GetMapping("/batch/{id}/download")
    public ResponseEntity<byte[]> downloadBatch(@PathVariable int id, @RequestParam("email") String email) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT results FROM batches b JOIN users u ON b.user_id = u.id WHERE b.id = ? AND u.email = ?");
            stmt.setInt(1, id);
            stmt.setString(2, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                byte[] content = rs.getString("results").getBytes(StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"geocoded_results_" + id + ".csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(content);
            }
        } catch(Exception e) {}
        return ResponseEntity.notFound().build();
    }

    // === UTILITY ENDPOINTS (Usage, Email, Admin, Test) ===

    @GetMapping("/usage")
    public ResponseEntity<Map<String, Integer>> getUsage(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = extractUserId(authHeader);
        return ResponseEntity.ok(lookupService.getUsage(userId));
    }

// ... inside GeocodeController.java ...

    // UPDATED: Captures "Leads" into the DB automatically
    @PostMapping("/email")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, Object> payload) {
        String email = (String) payload.get("email");
        String address = (String) payload.get("address");
        Map<String, Object> result = (Map<String, Object>) payload.get("result");
        
        if (email == null || address == null) return ResponseEntity.badRequest().body("Missing data");

        // 1. Capture the Lead (Shadow Account)
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement check = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            check.setString(1, email);
            if (!check.executeQuery().next()) {
                // User doesn't exist -> Create "Lead" account
                String randomPass = UUID.randomUUID().toString(); // Placeholder password
                PreparedStatement insert = conn.prepareStatement("INSERT INTO users (email, password_hash, subscription_status) VALUES (?, ?, 'lead')");
                insert.setString(1, email);
                insert.setString(2, encoder.encode(randomPass));
                insert.executeUpdate();
                System.out.println("New Lead Captured: " + email);
            }
        } catch (Exception e) {
            e.printStackTrace(); // Log but don't fail the email send
        }

        // 2. Send the Email with "Claim Account" Link
        // We direct them to "Forgot Password" flow effectively, so they can set a password
        String claimLink = "https://geocode-frontend.smartgeocode.io/forgot-password?email=" + email;
        
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        Content content = new Content("text/plain", 
            "Here are your results for: " + address + "\n\n" +
            "Lat: " + result.get("lat") + "\n" +
            "Lng: " + result.get("lng") + "\n\n" +
            "You have a free account waiting! Claim it here to batch process 500 more addresses:\n" + 
            claimLink
        );
        Mail mail = new Mail(from, "Your Geocode Results", to, content);
        
        try {
            SendGrid sg = new SendGrid(SENDGRID_API_KEY);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            sg.api(request);
            return ResponseEntity.ok("Email sent");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Email failed");
        }
    }

    private static class PremiumRequest {
        private String email;
        @JsonCreator public PremiumRequest(@JsonProperty("email") String email) { this.email = email; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
    }

    @PostMapping("/set-premium")
    public ResponseEntity<String> setPremium(@RequestBody PremiumRequest request) {
        String email = request.getEmail();
        if (email == null) return ResponseEntity.badRequest().body("Missing email");
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium' WHERE email = ?");
            stmt.setString(1, email);
            if (stmt.executeUpdate() > 0) return ResponseEntity.ok("Premium activated");
            return ResponseEntity.status(404).body("User not found");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Activation failed");
        }
    }

    @GetMapping("/activate-premium")
    public String activatePremium(@RequestParam("email") String email) {
        if (email == null) return "Missing email";
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium' WHERE email = ?");
            stmt.setString(1, email);
            if (stmt.executeUpdate() > 0) return "Premium activated for " + email;
            return "User not found";
        } catch (Exception e) {
            return "Activation failed";
        }
    }

    @GetMapping("/test-db")
    public String testDbConnection() {
        try (Connection conn = dataSource.getConnection()) {
            return "Connection successful: " + conn.getMetaData().getURL();
        } catch (Exception e) {
            return "Connection failed: " + e.getMessage();
        }
    }

    // === STRIPE (Webhook, Checkout, Portal) ===

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
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error");
        }
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, Object>> createCheckoutSession(@RequestBody Map<String, String> payload) {
        String checkoutKey = System.getenv("STRIPE_CKOUT_SECRET_KEY");
        Stripe.apiKey = checkoutKey;
        String email = payload.get("email");
        String address = payload.get("address");

        if (email == null) return ResponseEntity.badRequest().body(Map.of("error", "Missing email"));

        try {
            com.stripe.param.checkout.SessionCreateParams params = com.stripe.param.checkout.SessionCreateParams.builder()
                .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                .addPaymentMethodType(com.stripe.param.checkout.SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                    .setPrice("price_1Sd8JxA5JR9NQZvD0GCmjm6R") // Ensure this ID is correct in Stripe Dashboard
                    .setQuantity(1L).build())
                .setCustomerEmail(email)
                .setSuccessUrl("https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl("https://geocode-frontend.smartgeocode.io?cancelled=true")
                .putMetadata("address", address != null ? address : "")
                .build();

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(params);
            return ResponseEntity.ok(Map.of("url", session.getUrl()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-portal-session")
    public ResponseEntity<Map<String, Object>> createPortalSession(@RequestBody Map<String, String> payload) {
        Stripe.apiKey = System.getenv("STRIPE_SUB_SECRET_KEY");
        String email = payload.get("email");
        
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT stripe_customer_id FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next() && rs.getString("stripe_customer_id") != null) {
                com.stripe.param.billingportal.SessionCreateParams params = 
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                    .setCustomer(rs.getString("stripe_customer_id"))
                    .setReturnUrl("https://geocode-frontend.smartgeocode.io/dashboard")
                    .build();
                return ResponseEntity.ok(Map.of("url", com.stripe.model.billingportal.Session.create(params).getUrl()));
            }
            return ResponseEntity.status(400).body(Map.of("error", "No subscription found"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}