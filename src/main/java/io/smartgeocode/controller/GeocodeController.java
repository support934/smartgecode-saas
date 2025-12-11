package io.smartgeocode.controller;  // smartgeocode with 'o' - (g-e-o-c-o-d-e)

import org.springframework.web.bind.annotation.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.List;
import java.util.HashMap;

import com.sendgrid.SendGrid;
import com.sendgrid.Method;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.Request;
import com.sendgrid.Response;

import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "https://geocode-frontend.smartgeocode.io", "*"})
public class GeocodeController {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String SENDGRID_API_KEY = System.getenv("SENDGRID_API_KEY");  // From env var

    public GeocodeController() {
        System.out.println("=== GeocodeController instantiated -/api/geocode and /api/email ready ===");
    }

    @GetMapping("/geocode")
    public Map<String, Object> geocode(@RequestParam("address") String addr, @RequestParam(value = "addr", required = false) String addrFallback) {
        String finalAddr = addr != null ? addr : addrFallback;
        if (finalAddr == null || finalAddr.isEmpty()) {
            return Map.of("status", "error", "message", "Missing address param (use ?address= or ?addr=)");
        }
        try {
            System.out.println("=== GEOCODE HIT: param = " + finalAddr + " at " + new java.util.Date());

            // Nominatim policy: must include real User-Agent, email for bots
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

            // Parse JSON - could be array [] or error object {"error": "..."}
            Object parsed = mapper.readValue(response.body(), Object.class);
            if (parsed instanceof List && ((List<?>) parsed).isEmpty()) {
                return Map.of("status", "error", "message", "No results found for address: " + finalAddr);
            }

            if (parsed instanceof Map && ((Map<?, ?>) parsed).containsKey("error")) {
                return Map.of("status", "error", "message", "Nominatim error: " + ((Map<?, ?>) parsed).get("error"));
            }

            // Assume it's a list with results
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) parsed;
            if (results.isEmpty()) {
                return Map.of("status", "error", "message", "No results found for address: " + finalAddr);
            }

            // Extract first result
            Map<String, Object> result = results.get(0);
            String lat = (String) result.get("lat");
            String lon = (String) result.get("lon");
            String displayName = (String) result.get("display_name");

            // Build response map
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
            return Map.of("status", "error", "message", "Internal error: " + e.getMessage());
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
                return ResponseEntity.status(500).body("SendGrid failed: " + response.getBody());
            }
        } catch (Exception e) {
            System.err.println("Email send error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body("Email failed: " + e.getMessage());
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
          <title>Smartgecode - $5k Weekend Backend Project</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
            h1 { color: #333; }
            a { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            a:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>Smartgecode: Geocode App for $5k Weekend Revenue</h1>
          <p>Free single lookup with email capture. Upsell batch ($29/mo Stripe).</p>
          <a href="https://geocode-frontend.smartgecode.io">Try Free Lookup</a>
        </body>
        </html>
        """;
    }
}