package io.smartgeocode.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "visitor_activities")
public class VisitorActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The "Fingerprint" (Cookie ID) - Critical for V2 Analytics
    @Column(nullable = false)
    private String anonymousId;

    @Column(name = "user_id")
    private Long userId; // Nullable (Linked only if they sign up)

    @Column(nullable = false)
    private String actionType; // e.g., "BATCH_UPLOAD_ATTEMPT", "DEMO_LOOKUP"

    @Column(columnDefinition = "TEXT")
    private String metadata; // Stores the error message or file name

    private LocalDateTime createdAt = LocalDateTime.now();

    // Constructors, Getters, Setters
    public VisitorActivity() {}
    public VisitorActivity(String anonymousId, String actionType, String metadata) {
        this.anonymousId = anonymousId;
        this.actionType = actionType;
        this.metadata = metadata;
    }
    // (Generate Getters/Setters in your IDE)
    public String getAnonymousId() { return anonymousId; }
    public void setAnonymousId(String anonymousId) { this.anonymousId = anonymousId; }
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}