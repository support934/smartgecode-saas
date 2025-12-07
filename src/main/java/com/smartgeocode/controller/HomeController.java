package com.smartgecode.controller;  // smartgecode with 'o'

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

@RestController
@RequestMapping("/")
public class HomeController {

    @GetMapping
    public RedirectView home() {
        // Redirect root to API docs or frontend
        return new RedirectView("/api/geocode?address=Paris,France");
    }
}