package com.crosstrack.api.repository;

import com.crosstrack.api.model.UserMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserMemoryRepository extends JpaRepository<UserMemory, Long> {
    List<UserMemory> findByUserIdAndActiveTrue(Long userId);
    List<UserMemory> findByUserIdAndCategoryAndActiveTrue(Long userId, String category);
    List<UserMemory> findByUserIdAndActiveTrueOrderByLastRelevantAtDesc(Long userId);
}
