package io.smartgeocode.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode
public class UserLookupsId implements Serializable {
  private Long userId;
  private String monthYear;
}