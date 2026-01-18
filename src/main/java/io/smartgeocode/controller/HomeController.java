package io.smartgeocode.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

@RestController
public class HomeController {

    @GetMapping("/")
    public RedirectView home() {
        // Redirects root "smartgeocode.io" directly to your Vercel Frontend
        return new RedirectView("https://geocode-frontend.smartgeocode.io");
    }
}