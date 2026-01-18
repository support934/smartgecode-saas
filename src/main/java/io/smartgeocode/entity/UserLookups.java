package io.smartgeocode.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "user_lookups")
public class UserLookups {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private String monthYear;

    private String tier = "free";

    private int lookupCount = 0;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getMonthYear() {
        return monthYear;
    }

    public void setMonthYear(String monthYear) {
        this.monthYear = monthYear;
    }

    public String getTier() {
        return tier;
    }

    public void setTier(String tier) {
        this.tier = tier;
    }

    public int getLookupCount() {
        return lookupCount;
    }

    public void setLookupCount(int lookupCount) {
        this.lookupCount = lookupCount;
    }
}