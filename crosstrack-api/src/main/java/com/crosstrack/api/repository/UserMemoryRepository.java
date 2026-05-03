package com.crosstrack.api.repository;

import com.crosstrack.api.model.UserMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserMemoryRepository extends JpaRepository<UserMemory, Long> {
    List<UserMemory> findByUserIdAndActiveTrue(Long userId);
    List<UserMemory> findByUserIdAndCategoryAndActiveTrue(Long userId, String category);
    List<UserMemory> findByUserIdAndActiveTrueOrderByLastRelevantAtDesc(Long userId);
    long countByUserId(Long userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserMemory m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
