package io.smartgeocode.service;

import io.smartgeocode.entity.UserLookups;
import io.smartgeocode.repository.UserLookupsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.Map;

@Service
public class LookupService {

  @Autowired
  private UserLookupsRepository lookupRepo;

  public void incrementLookup(Long userId, int numLookups) {
    String currentMonth = YearMonth.now().toString(); // e.g., "2026-01"
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    if (record == null) {
      record = new UserLookups();
      record.setUserId(userId);
      record.setMonthYear(currentMonth);
      record.setTier("free"); // Default; update with real tier fetch later
      record.setLookupCount(0);
    }
    record.setLookupCount(record.getLookupCount() + numLookups);
    lookupRepo.save(record);
  }

  public boolean canPerformLookup(Long userId, int requested) {
    String currentMonth = YearMonth.now().toString();
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    int used = (record != null) ? record.getLookupCount() : 0;
    int limit = getLimitByTier(record != null ? record.getTier() : "free");
    return (used + requested) <= limit;
  }

  private int getLimitByTier(String tier) {
    return switch (tier) {
      case "premium" -> 10000;
      case "pro" -> 50000;
      case "unlimited" -> Integer.MAX_VALUE;
      default -> 500; // free
    };
  }

  public Map<String, Integer> getUsage(Long userId) {
    String currentMonth = YearMonth.now().toString();
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    int used = (record != null) ? record.getLookupCount() : 0;
    int limit = getLimitByTier(record != null ? record.getTier() : "free");
    return Map.of("used", used, "limit", limit);
  }
}