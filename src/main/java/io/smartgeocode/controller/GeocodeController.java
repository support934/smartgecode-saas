package io.smartgeocode.controller;  // smartgeocode with 'o' - (g-e-o-c-o-d-e)

import org.springframework.web.bind.annotation.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "https://geocode-frontend.smartgeocode.io", "*"})
public class GeocodeController {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String SENDGRID_API_KEY = System.getenv("SENDGRID_API_KEY");  // From env var

    @Autowired
    private DataSource dataSource;  // DB connection

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    // Secure JWT_SECRET: Use env var if set and long enough, else generate 256-bit key
    private final String JWT_SECRET;

    {
        String envSecret = System.getenv("JWT_SECRET");
        if (envSecret != null && envSecret.length() >= 32) {
            JWT_SECRET = envSecret;
        } else {
            SecretKey key = Keys.secretKeyFor(SignatureAlgorithm.HS256);  // Generates secure 256-bit key
            JWT_SECRET = Base64.getEncoder().encodeToString(key.getEncoded());
            System.out.println("Generated secure JWT_SECRET for local testing (set in env for production): " + JWT_SECRET);
        }
    }

    private final Random random = new Random();  // For rate limiting

    public GeocodeController() {
        System.out.println("=== GeocodeController instantiated - /api/email and /api/geocode ready ===");
    }

    // Auto-create tables on startup
    @PostConstruct
    public void initDatabase() {
        try (Connection conn = dataSource.getConnection()) {
            String sqlUsers = "CREATE TABLE IF NOT EXISTS users (" +
                              "id SERIAL PRIMARY KEY, " +
                              "email VARCHAR(255) UNIQUE NOT NULL, " +
                              "password_hash VARCHAR(255) NOT NULL, " +
                              "subscription_status VARCHAR(20) DEFAULT 'free', " +
                              "reset_token VARCHAR(500)" +
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
            PreparedStatement stmt2 = conn.prepareStatement(sqlBatches);
            stmt2.execute();
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
            return Map.of("status", "error", "message", "Missing address param (use ?address= or ?addr=)");
        }
        try {
            System.out.println("=== GEOCODE HIT: param = " + finalAddr + " at " + new Date());

            String encodedAddr = finalAddr.replace(" ", "+").replace(",", "%2C");
            String yourEmail = "sumeet.vasu@gmail.com";  // Real email
            String url = "https://nominatim.openstreetmap.org/search?format=json&email=" + yourEmail + "&q=" + encodedAddr + "&limit=1";

            var request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Referer", "https://smartgeocode.io")
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            System.out.println("=== NOMINATIM STATUS: " + response.statusCode());
            System.out.println("=== NOMINATIM RAW BODY: " + response.body());

            if (response.statusCode() != 200) {
                return Map.of("status", "error", "message", "Nominatim API error: " + response.statusCode() + " - " + response.body());
            }

            Object parsed = mapper.readValue(response.body(), Object.class);
            if (parsed instanceof List && ((List<?>) parsed).isEmpty()) {
                return Map.of("status", "error", "message", "No results found for address: " + finalAddr);
            }

            if (parsed instanceof Map && ((Map<?, ?>) parsed).containsKey("error")) {
                return Map.of("status", "error", "message", "Nominatim error: " + ((Map<?, ?>) parsed).get("error"));
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) parsed;
            if (results.isEmpty()) {
                return Map.of("status", "error", "message", "No results found for address: " + finalAddr);
            }

            Map<String, Object> result = results.get(0);
            String lat = (String) result.get("lat");
            String lon = (String) result.get("lon");
            String displayName = (String) result.get("display_name");

            Map<String, Object> responseMap = new HashMap<>();
            responseMap.put("status", "success");
            responseMap.put("lat", lat);
            responseMap.put("lng", lon);
            responseMap.put("formatted_address", displayName);

            System.out.println("=== GEOCODE SUCCESS: " + responseMap);
            return responseMap;

        } catch (Exception e) {
            System.out.println("=== GEOCODE EXCEPTION: " + e.getMessage());
            e.printStackTrace();
            return Map.of("status", "error", "message", "Internal error");
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
            String sql = "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), subscription_status VARCHAR(20) DEFAULT 'free', reset_token VARCHAR(500))";
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
            // Check if user exists
            PreparedStatement checkStmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            checkStmt.setString(1, email);
            ResultSet rs = checkStmt.executeQuery();
            if (rs.next()) {
                response.put("status", "error");
                response.put("message", "Account with this email already exists. Please log in instead.");
                return ResponseEntity.status(400).body(response);
            }

            // Hash password
            String hashedPassword = encoder.encode(password);

            // Insert user
            PreparedStatement insertStmt = conn.prepareStatement("INSERT INTO users (email, password_hash) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS);
            insertStmt.setString(1, email);
            insertStmt.setString(2, hashedPassword);
            insertStmt.executeUpdate();
            ResultSet generatedKeys = insertStmt.getGeneratedKeys();
            if (generatedKeys.next()) {
                int userId = generatedKeys.getInt(1);
                // Generate JWT
                String token = Jwts.builder()
                    .setSubject(email)
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 604800000))  // 7 days
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
                // Generate JWT
                String token = Jwts.builder()
                    .setSubject(email)
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 604800000))  // 7 days
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
            // Check if user exists
            PreparedStatement stmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (!rs.next()) {
                response.put("status", "error");
                response.put("message", "Email not found");
                return ResponseEntity.status(404).body(response);
            }

            // Generate UUID token
            String token = UUID.randomUUID().toString();

            // Update user with token
            PreparedStatement updateStmt = conn.prepareStatement("UPDATE users SET reset_token = ? WHERE email = ?");
            updateStmt.setString(1, token);
            updateStmt.setString(2, email);
            updateStmt.executeUpdate();

            // Send email with reset link
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

    // Set premium on Stripe success
    @PostMapping("/set-premium")
    public ResponseEntity<String> setPremium(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null) {
            return ResponseEntity.badRequest().body("Missing email");
        }
        try (Connection conn = dataSource.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("UPDATE users SET subscription_status = 'premium' WHERE email = ?");
            stmt.setString(1, email);
            int updated = stmt.executeUpdate();
            if (updated > 0) {
                return ResponseEntity.ok("Premium activated");
            } else {
                return ResponseEntity.status(404).body("User not found");
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Activation failed");
        }
    }
}