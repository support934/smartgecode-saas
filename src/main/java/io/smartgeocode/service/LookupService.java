package io.smartgeocode.service;

import io.smartgeocode.entity.UserLookups;
import io.smartgeocode.repository.UserLookupsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.Map;

@Service
public class LookupService {

  @Autowired
  private UserLookupsRepository lookupRepo;

  @Autowired
  private JdbcTemplate jdbcTemplate; // NEW: To query users table

  public void incrementLookup(Long userId, int numLookups) {
    String currentMonth = YearMonth.now().toString();
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    if (record == null) {
      record = new UserLookups();
      record.setUserId(userId);
      record.setMonthYear(currentMonth);
      record.setTier(getTierFromDb(userId)); // NEW: Fetch actual tier
      record.setLookupCount(0);
    }
    record.setLookupCount(record.getLookupCount() + numLookups);
    lookupRepo.save(record);
  }

  public boolean canPerformLookup(Long userId, int requested) {
    String currentMonth = YearMonth.now().toString();
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    int used = (record != null) ? record.getLookupCount() : 0;
    String tier = (record != null) ? record.getTier() : getTierFromDb(userId); // NEW: Fetch if missing
    int limit = getLimitByTier(tier);
    return (used + requested) <= limit;
  }

  private int getLimitByTier(String tier) {
    return switch (tier) {
      case "premium" -> 10000;
      default -> 500; // free or canceled
    };
  }

  private String getTierFromDb(Long userId) {
    if (userId == 0L) return "free"; // Guest
    String sql = "SELECT subscription_status FROM users WHERE id = ?";
    return jdbcTemplate.queryForObject(sql, String.class, userId);
  }

  public Map<String, Integer> getUsage(Long userId) {
    String currentMonth = YearMonth.now().toString();
    UserLookups record = lookupRepo.findByUserIdAndMonthYear(userId, currentMonth);
    int used = (record != null) ? record.getLookupCount() : 0;
    String tier = (record != null) ? record.getTier() : getTierFromDb(userId);
    int limit = getLimitByTier(tier);
    return Map.of("used", used, "limit", limit);
  }
}