package io.smartgeocode.model;

import jakarta.persistence.*; // If this errors, change to javax.persistence.*
import java.time.LocalDateTime;

@Entity
@Table(name = "visitor_activities")
public class VisitorActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "anonymous_id")
    private String anonymousId;

    // MATCHES YOUR DB COLUMN "action_type"
    @Column(name = "action_type") 
    private String activityType;

    // MATCHES YOUR DB COLUMN "metadata"
    @Column(name = "metadata") 
    private String details;

    // MATCHES YOUR DB COLUMN "created_at"
    @Column(name = "created_at") 
    private LocalDateTime timestamp;

    // MATCHES YOUR DB COLUMN "user_id"
    @Column(name = "user_id")
    private Long userId;

    // ==========================================
    // CONSTRUCTORS
    // ==========================================
    public VisitorActivity() {
        this.timestamp = LocalDateTime.now();
    }

    public VisitorActivity(String anonymousId, String activityType, String details) {
        this.anonymousId = anonymousId;
        this.activityType = activityType;
        this.details = details;
        this.timestamp = LocalDateTime.now();
    }

    // ==========================================
    // GETTERS & SETTERS
    // ==========================================
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAnonymousId() { return anonymousId; }
    public void setAnonymousId(String anonymousId) { this.anonymousId = anonymousId; }

    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}