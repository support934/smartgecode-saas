package io.smartgeocode.repository;

import io.smartgeocode.model.VisitorActivity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VisitorActivityRepository extends JpaRepository<VisitorActivity, Long> {
}