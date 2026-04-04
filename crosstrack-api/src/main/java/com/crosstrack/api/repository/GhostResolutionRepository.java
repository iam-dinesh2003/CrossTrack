package com.crosstrack.api.repository;

import com.crosstrack.api.model.GhostResolution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

public interface GhostResolutionRepository extends JpaRepository<GhostResolution, Long> {
    Optional<GhostResolution> findByApplicationId(Long appId);
    long countByResolvedAtAfter(LocalDateTime date);

    @Modifying
    @Query("DELETE FROM GhostResolution gr WHERE gr.application.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
