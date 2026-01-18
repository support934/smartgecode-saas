package io.smartgeocode.repository;

import io.smartgeocode.entity.UserLookups;
import io.smartgeocode.entity.UserLookupsId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLookupsRepository extends JpaRepository<UserLookups, UserLookupsId> {
  UserLookups findByUserIdAndMonthYear(Long userId, String monthYear);
}