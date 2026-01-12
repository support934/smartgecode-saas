package io.smartgeocode.controller;

import org.springframework.web.bind.annotation.*;
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
import com.stripe.param.checkout.SessionCreateParams;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import com.stripe.model.Subscription;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.checkout.Session; // This is the correct class

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "https://geocode-frontend.smartgeocode.io", "*"})
public class GeocodeController {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String SENDGRID_API_KEY = System.getenv("SENDGRID_API_KEY");

    @Autowired
    private DataSource dataSource;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    private final String JWT_SECRET;

    {
        String envSecret = System.getenv("JWT_SECRET");
        if (envSecret != null && envSecret.length() >= 32) {
            JWT_SECRET = envSecret;
        } else {
            SecretKey key = Keys.secretKeyFor(SignatureAlgorithm.HS256);
            JWT_SECRET = Base64.getEncoder().encodeToString(key.getEncoded());
            System.out.println("Generated secure JWT_SECRET for local testing (set in env for production): " + JWT_SECRET);
        }
    }

    private final Random random = new Random();

    public GeocodeController() {
        System.out.println("=== GeocodeController instantiated - /api/email and /api/geocode ready ===");
    }

    static {
        System.out.println("DEBUG: Static block executing - loading Stripe keys");

        String subKey = System.getenv("STRIPE_SUB_SECRET_KEY");
        if (subKey == null || subKey.isEmpty()) {
            System.err.println("FATAL ERROR: STRIPE_SUB_SECRET_KEY is not set in environment variables!");
        } else {
            System.out.println("SUCCESS: STRIPE_SUB_SECRET_KEY is present (for portal/subscription management)");
        }

        String checkoutKey = System.getenv("STRIPE_CKOUT_SECRET_KEY");
        if (checkoutKey == null || checkoutKey.isEmpty()) {
            System.err.println("FATAL ERROR: STRIPE_CKOUT_SECRET_KEY is not set in environment variables!");
        } else {
            System.out.println("SUCCESS: STRIPE_CKOUT_SECRET_KEY is present (for checkout)");
        }
    }

    @PostConstruct
    public void initDatabase() {
        System.out.println("initDatabase() started - attempting DB connection");
        try (Connection conn = dataSource.getConnection()) {
            System.out.println("DB connection successful: " + conn.getMetaData().getURL());
            String sqlUsers = "CREATE TABLE IF NOT EXISTS users (" +
                              "id SERIAL PRIMARY KEY, " +
                              "email VARCHAR(255) UNIQUE NOT NULL, " +
                              "password_hash VARCHAR(255) NOT NULL, " +
                              "subscription_status VARCHAR(20) DEFAULT 'free', " +
                              "reset_token VARCHAR(500), " +
                              "stripe_customer_id VARCHAR(255)" +
                              ")";
            String sqlBatches = "CREATE TABLE IF NOT EXISTS batches (" +
                                "id SERIAL PRIMARY KEY, " +
                                "user_id INTEGER REFERENCES users(id), " +
                                "status VARCHAR(20) DEFAULT 'processing', " +
                                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                                "results TEXT" +
                                ")";
            PreparedStatement stmt1 = conn.prepareStatement(sqlUsers);
            stmt1.execute();
            System.out.println("Users table created/ensured");
            PreparedStatement stmt2 = conn.prepareStatement(sqlBatches);
            stmt2.execute();
            System.out.println("Batches table created/ensured");
            System.out.println("DB tables 'users' and 'batches' ensured on startup");
        } catch (Exception e) {
            System.err.println("DB init failed on startup: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @GetMapping("/geocode")
    public Map<String, Object> geocode(@RequestParam("address") String addr, @RequestParam(value = "addr", required = false) String addrFallback) {
        String finalAddr = addr != null ? addr : addrFallback;
        if (finalAddr == null || finalAddr.isEmpty()) {
            return Map.of("status", "error", "message", "Missing address param");
        }
        try {
            System.out.println("=== GEOCODE HIT: param = " + finalAddr + " at " + new Date());

            String encodedAddr = finalAddr.replace(" ", "+").replace(",", "%2C");
            String yourEmail = System.getenv("NOMINATIM_EMAIL") != null ? System.getenv("NOMINATIM_EMAIL") : "sumeet.vasu@gmail.com";
            String url = "https://nominatim.openstreetmap.org/search?format=json&email=" + yourEmail + "&q=" + encodedAddr + "&limit=1";

            var request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "smartgeocodeApp/1.0 (sumeet.vasu@gmail.com)")
                    .header("Referer", "https://smartgeocode.io")
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                return Map.of("status", "error", "message", "Service error—try again");
            }

            Object parsed = mapper.readValue(response.body(), Object.class);
            if (parsed instanceof List && ((List<?>) parsed).isEmpty()) {
                return Map.of("status", "error", "message", "No results—try more details (city, state, country)");
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) parsed;
            Map<String, Object> result = results.get(0);
            String lat = (String) result.get("lat");
            String lon = (String) result.get("lon");
            String displayName = (String) result.get("display_name");

            Map<String, Object> responseMap = new HashMap<>();
            responseMap.put("status", "success");
            responseMap.put("lat", lat);
            responseMap.put("lng", lon);
            responseMap.put("formatted_address", displayName);

            return responseMap;

        } catch (Exception e) {
            return Map.of("status", "error", "message", "Geocode failed—try more specific address");
        }
    }

    @PostMapping("/email")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, Object> payload) {
        String email = (String) payload.get("email");
        String address = (String) payload.get("address");
        Map<String, Object> result = (Map<String, Object>) payload.get("result");
        SendGrid sg = new SendGrid(SENDGRID_API_KEY);
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        Content content = new Content("text/plain", "Address: " + address + "\nLat: " + result.get("lat") + "\nLng: " + result.get("lng") + "\nUpgrade: https://geocode-frontend.smartgeocode.io/upgrade");
        Mail mail = new Mail(from, "Your Geocode Results", to, content);
        try {
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            Response response = sg.api(request);
            System.out.println("SendGrid status: " + response.getStatusCode());
            if (response.getStatusCode() == 202) {
                return ResponseEntity.ok("Email sent");
            } else {
                System.err.println("SendGrid error: " + response.getBody());
                return ResponseEntity.status(500).body("SendGrid failed");
            }
        } catch (Exception e) {
            System.err.println("Email send error: " + e.getMessage());
            return ResponseEntity.status(500).body("Email failed");
        }
    }

    @GetMapping("/")
    public String landing() {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>smartgeocode - $5k Weekend Backend Project</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
                h1 { color: #333; }
                a { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                a:hover { background: #0056b3; }
              </style>
            </head>
            <body>
              <h1>smartgeocode: Geocode App for $5k Weekend Revenue</h1>
              <p>Free single lookup with email capture. Upsell batch ($29/mo Stripe).</p>
              <a href="https://geocode-frontend.smartgeocode.io">Try Free Lookup</a>
            </body>
            </html>
            """;
    }

    @PostMapping("/init-db")
    public ResponseEntity<String> initDb() {
        try (Connection conn = dataSource.getConnection()) {
            String sql = "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), subscription_status VARCHAR(20) DEFAULT 'free', reset_token VARCHAR(500), stripe_customer_id VARCHAR(255))";
            PreparedStatement stmt = conn.prepareStatement(sql);
            stmt.execute();
            return ResponseEntity.ok("DB initialized");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("DB init failed");
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        Map<String, Object> response = new HashMap<>();

        if (email == null || password == null) {
            response.put("status", "error");
            response.put("message", "Missing email or password");
            return ResponseEntity.badRequest().body(response);
        }

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement checkStmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            checkStmt.setString(1, email);
            ResultSet rs = checkStmt.executeQuery();
            if (rs.next()) {
                response.put("status", "error");
                response.put("message", "Account with this email already exists. Please log in instead.");
                return ResponseEntity.status(400).body(response);
            }

            String hashedPassword = encoder.encode(password);

            PreparedStatement insertStmt = conn.prepareStatement("INSERT INTO users (email, password_hash) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS);
            insertStmt.setString(1, email);
            insertStmt.setString(2, hashedPassword);
            insertStmt.executeUpdate();
            ResultSet generatedKeys = insertStmt.getGeneratedKeys();
            if (generatedKeys.next()) {
                int userId = generatedKeys.getInt(1);
                String token = Jwts.builder()
                    .setSubject(email)
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 604800000))
                    .signWith(SignatureAlgorithm.HS256, JWT_SECRET)
                    .compact();

                response.put("status", "success");
                response.put("token", token);
                response.put("userId", userId);
                return ResponseEntity.ok(response);
            } else {
                response.put("status", "error");
                response.put("message", "Signup failed—try again");
                return ResponseEntity.status(500).body(response);
            }
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Signup failed—try again");
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        Map<String, Object> response = new HashMap<>();

        if (email == null || password == null) {
            response.put("status", "error");
            response.put("message", "Missing email or password");
            return ResponseEntity.badRequest().body(response);
        }

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, password_hash FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next() && encoder.matches(password, rs.getString("password_hash"))) {
                String token = Jwts.builder()
                    .setSubject(email)
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 604800000))
                    .signWith(SignatureAlgorithm.HS256, JWT_SECRET)
                    .compact();

                response.put("status", "success");
                response.put("token", token);
                response.put("userId", rs.getInt("id"));
                return ResponseEntity.ok(response);
            } else {
                response.put("status", "error");
                response.put("message", "Invalid email or password");
                return ResponseEntity.status(401).body(response);
            }
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Login failed—try again");
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        Map<String, Object> response = new HashMap<>();

        if (email == null) {
            response.put("status", "error");
            response.put("message", "Missing email");
            return ResponseEntity.badRequest().body(response);
        }

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (!rs.next()) {
                response.put("status", "error");
                response.put("message", "Email not found");
                return ResponseEntity.status(404).body(response);
            }

            String token = UUID.randomUUID().toString();

            PreparedStatement updateStmt = conn.prepareStatement("UPDATE users SET reset_token = ? WHERE email = ?");
            updateStmt.setString(1, token);
            updateStmt.setString(2, email);
            updateStmt.executeUpdate();

            sendResetEmail(email, token);

            response.put("status", "success");
            response.put("message", "Reset link sent to your email");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Reset failed—try again");
            return ResponseEntity.status(500).body(response);
        }
    }

    private void sendResetEmail(String email, String token) {
        SendGrid sg = new SendGrid(SENDGRID_API_KEY);
        Email from = new Email("noreply@smartgeocode.io");
        Email to = new Email(email);
        Content content = new Content("text/html", "<h2>Reset Your smartgeocode Password</h2><p>Click <a href='https://geocode-frontend.smartgeocode.io/reset-password?token=" + token + "'>here</a> to reset. Expires in 1 hour.</p>");
        Mail mail = new Mail(from, "Password Reset", to, content);
        try {
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            sg.api(request);
            System.out.println("Reset email sent to " + email);
        } catch (Exception e) {
            System.err.println("Reset email failed: " + e.getMessage());
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        String newPassword = request.get("password");
        Map<String, Object> response = new HashMap<>();

        if (token == null || newPassword == null) {
            response.put("status", "error");
            response.put("message", "Missing token or password");
            return ResponseEntity.badRequest().body(response);
        }

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT email FROM users WHERE reset_token = ?");
            stmt.setString(1, token);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                String email = rs.getString("email");
                PreparedStatement updateStmt = conn.prepareStatement("UPDATE users SET password_hash = ?, reset_token = NULL WHERE email = ?");
                updateStmt.setString(1, encoder.encode(newPassword));
                updateStmt.setString(2, email);
                updateStmt.executeUpdate();
                response.put("status", "success");
                response.put("message", "Password reset successfully. Log in now.");
                return ResponseEntity.ok(response);
            } else {
                response.put("status", "error");
                response.put("message", "Invalid or expired token");
                return ResponseEntity.status(400).body(response);
            }
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Reset failed—try again");
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/stripe-webhook")
    public ResponseEntity<String> stripeWebhook(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sigHeader) {
        String webhookSecret = System.getenv("STRIPE_WEBHOOK_SECRET");
        try {
            Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);

            if ("customer.subscription.created".equals(event.getType())) {
                Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().get();
                String customerId = subscription.getCustomer();
                try (Connection conn = dataSource.getConnection()) {
                    PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium', stripe_customer_id = ? WHERE stripe_customer_id IS NULL OR stripe_customer_id = ?");
                    stmt.setString(1, customerId);
                    stmt.setString(2, customerId);
                    stmt.executeUpdate();
                }
            } else if ("customer.subscription.deleted".equals(event.getType())) {
                Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().get();
                String customerId = subscription.getCustomer();
                try (Connection conn = dataSource.getConnection()) {
                    PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'canceled' WHERE stripe_customer_id = ?");
                    stmt.setString(1, customerId);
                    stmt.executeUpdate();
                }
            }

            return ResponseEntity.ok("Webhook received");
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(400).body("Webhook signature invalid");
        } catch (Exception e) {
            System.err.println("Webhook error: " + e.getMessage());
            return ResponseEntity.status(500).body("Webhook failed");
        }
    }

    private static class PremiumRequest {
        private String email;

        @JsonCreator
        public PremiumRequest(@JsonProperty("email") String email) {
            this.email = email;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    @PostMapping("/set-premium")
    public ResponseEntity<String> setPremium(@RequestBody PremiumRequest request) {
        System.out.println("set-premium called with: " + request);
        String email = request.getEmail();
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Missing email");
        }
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium' WHERE email = ?");
            stmt.setString(1, email.trim());
            int updated = stmt.executeUpdate();
            if (updated > 0) {
                System.out.println("Premium activated for: " + email.trim());
                return ResponseEntity.ok("Premium activated");
            } else {
                return ResponseEntity.status(404).body("User not found");
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Activation failed");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@RequestParam("email") String email) {
        Map<String, Object> response = new HashMap<>();
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT subscription_status FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                response.put("subscription_status", rs.getString("subscription_status"));
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(404).body(Map.of("message", "User not found"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed"));
        }
    }

    @PostMapping(value = "/batch-geocode", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> batchGeocode(@RequestParam("file") MultipartFile file, @RequestParam("email") String email) {
        Map<String, Object> response = new HashMap<>();

        if (file.isEmpty()) {
            response.put("status", "error");
            response.put("message", "No file uploaded");
            return ResponseEntity.badRequest().body(response);
        }

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement userStmt = conn.prepareStatement("SELECT id, subscription_status FROM users WHERE email = ?");
            userStmt.setString(1, email);
            ResultSet rs = userStmt.executeQuery();
            if (!rs.next()) {
                response.put("status", "error");
                response.put("message", "User not found");
                return ResponseEntity.status(404).body(response);
            }
            int userId = rs.getInt("id");
            String subscription = rs.getString("subscription_status");
            if (!"premium".equals(subscription)) {
                response.put("status", "error");
                response.put("message", "Premium subscription required");
                return ResponseEntity.status(403).body(response);
            }

            int batchId = -1;
            PreparedStatement batchStmt = conn.prepareStatement("INSERT INTO batches (user_id, status) VALUES (?, 'processing')", Statement.RETURN_GENERATED_KEYS);
            batchStmt.setInt(1, userId);
            batchStmt.executeUpdate();
            ResultSet generatedKeys = batchStmt.getGeneratedKeys();
            if (generatedKeys.next()) {
                batchId = generatedKeys.getInt(1);
            }

            List<Map<String, String>> fullResults = new ArrayList<>();
            System.out.println("=== DEBUG: NEW COMMENT-SKIP VERSION LIVE - 2025-12-30 ===");
            try (CSVReader csvReader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
                String[] headers = null;
                String[] line;
                int skippedLeading = 0;
                int skippedData = 0;

                // Phase 1: Skip leading comments/empty until header
                while ((line = csvReader.readNext()) != null) {
                    if (line.length == 0 || (line[0] != null && line[0].trim().startsWith("#")) || allColumnsEmpty(line)) {
                        skippedLeading++;
                        continue;
                    }
                    headers = line;
                    break;
                }

                System.out.println("DEBUG: Skipped " + skippedLeading + " leading comment/blank lines");

                if (headers == null) {
                    System.out.println("DEBUG: No header row found after skipping all lines");
                    response.put("status", "error");
                    response.put("message", "CSV is empty or has only comments/blank lines - no header row");
                    return ResponseEntity.badRequest().body(response);
                }

                // Case-insensitive check for 'address'
                int addressIndex = -1;
                for (int i = 0; i < headers.length; i++) {
                    String headerTrim = headers[i].trim().toLowerCase();
                    if (headerTrim.equals("address")) {
                        addressIndex = i;
                        break;
                    }
                }

                if (addressIndex == -1) {
                    System.out.println("DEBUG: Headers found but missing 'address' (case-insensitive): " + java.util.Arrays.toString(headers));
                    response.put("status", "error");
                    response.put("message", "CSV must have an 'address' column (case-insensitive check)");
                    return ResponseEntity.badRequest().body(response);
                }

                System.out.println("DEBUG: Headers found with 'address' at index " + addressIndex + ": " + java.util.Arrays.toString(headers));

                // Phase 2: Process data rows
                while ((line = csvReader.readNext()) != null) {
                    if (line.length == 0 || (line[0] != null && line[0].trim().startsWith("#")) || allColumnsEmpty(line)) {
                        skippedData++;
                        continue;
                    }

                    Map<String, String> rowMap = new HashMap<>();
                    for (int i = 0; i < headers.length; i++) {
                        String header = headers[i].trim().toLowerCase();
                        rowMap.put(header, line.length > i ? line[i].trim() : "");
                    }

                    // Build clean query (name/landmark first for landmarks)
                    StringBuilder query = new StringBuilder();

                    String name = rowMap.get("name");
                    if (name != null && !name.isEmpty()) {
                        query.append(name.trim());
                    }

                    String address = rowMap.get("address");
                    if (address != null && !address.isEmpty() && !address.equalsIgnoreCase("N/A")) {
                        if (query.length() > 0) query.append(", ");
                        query.append(address.trim());
                    }

                    String city = rowMap.get("city");
                    if (city != null && !city.isEmpty()) {
                        if (query.length() > 0) query.append(", ");
                        query.append(city.trim());
                    }

                    String state = rowMap.get("state");
                    if (state != null && !state.isEmpty()) {
                        if (query.length() > 0) query.append(", ");
                        query.append(state.trim());
                    }

                    String zip = rowMap.get("zip");
                    if (zip != null && !zip.isEmpty()) {
                        if (query.length() > 0) query.append(", ");
                        query.append(zip.trim());
                    }

                    String country = rowMap.get("country");
                    if (country != null && !country.isEmpty()) {
                        if (query.length() > 0) query.append(", ");
                        query.append(country.trim());
                    }

                    String finalQuery = query.toString().trim();
                    if (finalQuery.isEmpty()) {
                        rowMap.put("status", "skipped");
                        rowMap.put("message", "Blank or N/A address");
                    } else {
                        if (finalQuery.length() > 80) {
                            finalQuery = finalQuery.substring(0, 80);
                        }

                        System.out.println("Sending query to Nominatim: " + finalQuery);

                        Map<String, Object> geo = geocode(finalQuery, null);
                        if ("success".equals(geo.get("status"))) {
                            rowMap.put("lat", (String) geo.get("lat"));
                            rowMap.put("lng", (String) geo.get("lng"));
                            rowMap.put("formatted_address", (String) geo.get("formatted_address"));
                            rowMap.put("status", "success");
                        } else {
                            String fallback = address;
                            if (country != null && !country.isEmpty()) {
                                if (!fallback.isEmpty()) fallback += ", ";
                                fallback += country.trim();
                            }
                            fallback = fallback.trim();
                            if (!fallback.isEmpty() && !fallback.equals(finalQuery)) {
                                System.out.println("Fallback query: " + fallback);
                                geo = geocode(fallback, null);
                                if ("success".equals(geo.get("status"))) {
                                    rowMap.put("lat", (String) geo.get("lat"));
                                    rowMap.put("lng", (String) geo.get("lng"));
                                    rowMap.put("formatted_address", (String) geo.get("formatted_address"));
                                    rowMap.put("status", "success");
                                } else {
                                    rowMap.put("status", "error");
                                    rowMap.put("message", (String) geo.get("message"));
                                }
                            } else {
                                rowMap.put("status", "error");
                                rowMap.put("message", (String) geo.get("message"));
                            }
                        }
                    }
                    fullResults.add(rowMap);
                }

                System.out.println("=== DEBUG: Skipped " + skippedData + " data comment/blank lines during processing");
            }

            // Build CSV results
            StringBuilder csvResults = new StringBuilder();
            csvResults.append("address,lat,lng,formatted_address,status,message\n");
            for (Map<String, String> row : fullResults) {
                csvResults.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
                    row.getOrDefault("address", ""),
                    row.getOrDefault("lat", ""),
                    row.getOrDefault("lng", ""),
                    row.getOrDefault("formatted_address", ""),
                    row.getOrDefault("status", ""),
                    row.getOrDefault("message", "")));
            }

            PreparedStatement updateBatch = conn.prepareStatement("UPDATE batches SET status = 'complete', results = ? WHERE id = ?");
            updateBatch.setString(1, csvResults.toString());
            updateBatch.setInt(2, batchId);
            updateBatch.executeUpdate();

            List<Map<String, String>> preview = fullResults.subList(0, Math.min(50, fullResults.size()));

            response.put("status", "success");
            response.put("batchId", batchId);
            response.put("preview", preview);
            response.put("totalRows", fullResults.size());
            response.put("message", "Batch processed");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", "Batch processing failed—try again: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    private boolean allColumnsEmpty(String[] line) {
        for (String col : line) {
            if (col != null && !col.trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    @GetMapping("/batches")
    public ResponseEntity<List<Map<String, Object>>> getBatches(@RequestParam("email") String email) {
        List<Map<String, Object>> batches = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT id, status, created_at FROM batches WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY created_at DESC");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> batch = new HashMap<>();
                batch.put("id", rs.getInt("id"));
                batch.put("status", rs.getString("status"));
                batch.put("created_at", rs.getTimestamp("created_at").toString());
                batches.add(batch);
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(batches);
        }
        return ResponseEntity.ok(batches);
    }

    @GetMapping("/batch/{id}")
    public ResponseEntity<Object> getBatch(@PathVariable int id, @RequestParam("email") String email, @RequestParam(value = "download", required = false) Boolean download) {
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT results, status FROM batches WHERE id = ? AND user_id = (SELECT id FROM users WHERE email = ?)");
            stmt.setInt(1, id);
            stmt.setString(2, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                String resultsCsv = rs.getString("results");
                if (download != null && download) {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.parseMediaType("text/csv"));
                    headers.setContentDispositionFormData("attachment", "batch-" + id + ".csv");
                    return ResponseEntity.ok().headers(headers).body(resultsCsv.getBytes());
                } else {
                    return ResponseEntity.ok(Map.of("results", resultsCsv.split("\n"), "status", rs.getString("status")));
                }
            } else {
                return ResponseEntity.status(404).body(Map.of("message", "Batch not found"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Batch load failed"));
        }
    }

    @GetMapping("/activate-premium")
    public String activatePremium(@RequestParam("email") String email) {
        if (email == null || email.trim().isEmpty()) {
            return "Missing email";
        }
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium' WHERE email = ?");
            stmt.setString(1, email.trim());
            int updated = stmt.executeUpdate();
            if (updated > 0) {
                return "Premium activated for " + email;
            } else {
                return "User not found";
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "Activation failed";
        }
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, Object>> createCheckoutSession(@RequestBody Map<String, String> payload) {
        Map<String, Object> response = new HashMap<>();
        System.out.println("=== DEBUG: Checkout session request received: " + payload);

        String checkoutKey = System.getenv("STRIPE_CKOUT_SECRET_KEY");
        if (checkoutKey == null || checkoutKey.isEmpty()) {
            System.err.println("FATAL ERROR: STRIPE_CKOUT_SECRET_KEY missing for checkout");
            response.put("error", "Server configuration error");
            return ResponseEntity.status(500).body(response);
        }
        Stripe.apiKey = checkoutKey;
        System.out.println("DEBUG: Using STRIPE_CKOUT_SECRET_KEY for checkout session");

        String email = payload.get("email");
        String address = payload.get("address");

        if (email == null || address == null) {
            response.put("error", "Missing email or address");
            return ResponseEntity.status(400).body(response);
        }

        try {
            com.stripe.param.checkout.SessionCreateParams params = com.stripe.param.checkout.SessionCreateParams.builder()
                .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                .addPaymentMethodType(com.stripe.param.checkout.SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(
                    com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                        .setPrice("price_1Sd8JxA5JR9NQZvD0GCmjm6R")
                        .setQuantity(1L)
                        .build()
                )
                .setCustomerEmail(email)
                .setSuccessUrl("https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl("https://geocode-frontend.smartgeocode.io?cancelled=true")
                .putMetadata("address", address)
                .build();

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(params);

            return ResponseEntity.ok(Map.of("url", session.getUrl()));
        } catch (StripeException e) {
            System.err.println("DEBUG: Checkout Stripe error: " + e.getMessage());
            e.printStackTrace();
            response.put("error", "Checkout failed: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        } catch (Exception e) {
            System.err.println("DEBUG: General checkout error: " + e.getMessage());
            e.printStackTrace();
            response.put("error", "Failed to create checkout session");
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/create-portal-session")
    public ResponseEntity<Map<String, Object>> createPortalSession(@RequestBody Map<String, String> payload) {
        Map<String, Object> response = new HashMap<>();
        System.out.println("=== DEBUG: Portal session request received: " + payload);

        String subKey = System.getenv("STRIPE_SUB_SECRET_KEY");
        if (subKey == null || subKey.isEmpty()) {
            System.err.println("FATAL ERROR: STRIPE_SUB_SECRET_KEY missing for portal");
            response.put("error", "Server configuration error");
            return ResponseEntity.status(500).body(response);
        }
        Stripe.apiKey = subKey;
        System.out.println("DEBUG: Using STRIPE_SUB_SECRET_KEY for portal session");

        String email = payload.get("email");
        if (email == null) {
            System.out.println("DEBUG: No email in payload");
            response.put("error", "Missing email");
            return ResponseEntity.status(400).body(response);
        }

        email = email.toLowerCase().trim();
        System.out.println("DEBUG: Normalized email: " + email);

        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT stripe_customer_id FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (!rs.next() || rs.getString("stripe_customer_id") == null) {
                System.out.println("DEBUG: No customer ID found for email: " + email);
                response.put("error", "No Stripe customer found");
                return ResponseEntity.status(400).body(response);
            }
            String customerId = rs.getString("stripe_customer_id");
            System.out.println("DEBUG: Found customer ID: " + customerId);

            SessionCreateParams params = SessionCreateParams.builder()
                .setCustomer(customerId)
                .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
                .setReturnUrl("https://geocode-frontend.smartgeocode.io/dashboard")
                .build();

            Session session = Session.create(params);
            System.out.println("DEBUG: Portal URL generated: " + session.getUrl());

            response.put("url", session.getUrl());
            return ResponseEntity.ok(response);
        } catch (StripeException e) {
            System.err.println("DEBUG: Stripe error: " + e.getMessage());
            e.printStackTrace();
            response.put("error", "Stripe error: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        } catch (Exception e) {
            System.err.println("DEBUG: General error: " + e.getMessage());
            e.printStackTrace();
            response.put("error", "Failed to create portal session");
            return ResponseEntity.status(500).body(response);
        }
    }

    @GetMapping("/test-db")
    public String testDbConnection() {
        try (Connection conn = dataSource.getConnection()) {
            return "Connection successful: " + conn.getMetaData().getURL();
        } catch (Exception e) {
            e.printStackTrace();
            return "Connection failed: " + e.getMessage();
        }
    }

}