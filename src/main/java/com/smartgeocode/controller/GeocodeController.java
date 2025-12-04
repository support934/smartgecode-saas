package com.smartgeocode.controller;  // Fixed: smartgeocode (g-e-o-c-o-d-e)

import org.springframework.web.bind.annotation.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.List;
import java.util.HashMap;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "*"})
public class GeocodeController {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping("/geocode")
    public Map<String, Object> geocode(@RequestParam("address") String addr) {
        try {
            System.out.println("=== GEOCODE HIT: address param = " + addr + " at " + new java.util.Date());

            // Nominatim policy: must include real User-Agent, email for bots
            String encodedAddr = addr.replace(" ", "+").replace(",", "%2C");
            String yourEmail = "sumeet.vasu@gmail.com";  // <-- REPLACE WITH YOUR REAL EMAIL!
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
                return Map.of("status", "error", "message", "No results found for address: " + addr);
            }

            if (parsed instanceof Map && ((Map<?, ?>) parsed).containsKey("error")) {
                return Map.of("status", "error", "message", "Nominatim error: " + ((Map<?, ?>) parsed).get("error"));
            }

            // Assume it's a list with results
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) parsed;
            if (results.isEmpty()) {
                return Map.of("status", "error", "message", "No results found for address: " + addr);
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
}