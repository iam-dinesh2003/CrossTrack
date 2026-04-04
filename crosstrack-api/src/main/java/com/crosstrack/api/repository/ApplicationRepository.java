package com.crosstrack.api.repository;

import com.crosstrack.api.model.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByUserIdOrderByAppliedAtDesc(Long userId);

    List<Application> findByUserIdAndStatus(Long userId, String status);

    List<Application> findByUserIdAndStatusAndAppliedAtBefore(Long userId, String status, LocalDateTime date);

    // For ghost scheduler — find all stale "applied" apps across all users
    List<Application> findByStatusAndAppliedAtBefore(String status, LocalDateTime date);

    // For follow-up scheduler — all APPLIED apps across all users
    List<Application> findByStatusAndAppliedAtIsNotNull(String status);

    List<Application> findByUserIdAndRoleAndSource(Long userId, String role, String source);

    @Modifying
    @Query("DELETE FROM Application a WHERE a.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);

    boolean existsBySourceEmailId(String sourceEmailId);

    Optional<Application> findFirstByUserIdAndCompanyIgnoreCaseAndSource(Long userId, String company, String source);

    long countByUserId(Long userId);

    long countByUserIdAndStatus(Long userId, String status);

    @Query("SELECT a.platform, COUNT(a) FROM Application a WHERE a.user.id = :userId GROUP BY a.platform")
    List<Object[]> countByUserIdGroupByPlatform(Long userId);

    @Query("SELECT FUNCTION('YEARWEEK', a.appliedAt), COUNT(a) FROM Application a WHERE a.user.id = :userId GROUP BY FUNCTION('YEARWEEK', a.appliedAt) ORDER BY FUNCTION('YEARWEEK', a.appliedAt) DESC")
    List<Object[]> countWeeklyByUserId(Long userId);
}
