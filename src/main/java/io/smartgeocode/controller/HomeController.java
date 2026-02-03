package io.smartgeocode.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

@RestController
public class HomeController {

    // Inject URL from config.
    // SAFETY NET: If config is missing, default to "https://geocode-frontend.smartgeocode.io"
    @Value("${app.frontend.url:https://geocode-frontend.smartgeocode.io}")
    private String frontendUrl;

    @GetMapping("/")
    public RedirectView home() {
        return new RedirectView(frontendUrl);
    }
}