package com.crosstrack.api.repository;

import com.crosstrack.api.model.Application;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    boolean existsByUserIdAndCompanyAndRole(Long userId, String company, String role);

    Optional<Application> findFirstByUserIdAndCompanyIgnoreCaseAndSource(Long userId, String company, String source);

    long countByUserId(Long userId);

    Optional<Application> findTopByUserIdOrderByAppliedAtDesc(Long userId);

    long countByUserIdAndStatus(Long userId, String status);

    @Query("SELECT a.platform, COUNT(a) FROM Application a WHERE a.user.id = :userId GROUP BY a.platform")
    List<Object[]> countByUserIdGroupByPlatform(Long userId);

    @Query("SELECT FUNCTION('YEARWEEK', a.appliedAt), COUNT(a) FROM Application a WHERE a.user.id = :userId GROUP BY FUNCTION('YEARWEEK', a.appliedAt) ORDER BY FUNCTION('YEARWEEK', a.appliedAt) DESC")
    List<Object[]> countWeeklyByUserId(Long userId);

    // Admin: count apps across all users since a date
    long countByAppliedAtAfter(LocalDateTime date);

    // Admin: count apps by status across all users
    long countByStatus(String status);

    // Admin: paginated list of all apps with user info
    @Query("SELECT a FROM Application a JOIN FETCH a.user ORDER BY a.appliedAt DESC")
    List<Application> findAllWithUser(Pageable pageable);

    // Admin: paginated list filtered by status
    @Query("SELECT a FROM Application a JOIN FETCH a.user WHERE a.status = :status ORDER BY a.appliedAt DESC")
    List<Application> findAllWithUserByStatus(@Param("status") String status, Pageable pageable);

    // Admin: count all apps (for pagination total)
    @Query("SELECT COUNT(a) FROM Application a")
    long countAllApplications();

    // Admin stats: source breakdown (EMAIL_SCAN / MANUAL / EXTENSION)
    @Query("SELECT a.source, COUNT(a) FROM Application a WHERE a.source IS NOT NULL GROUP BY a.source")
    List<Object[]> countGroupBySource();

    // Admin stats: offers per platform (for offer-rate intelligence)
    @Query("SELECT a.platform, COUNT(a) FROM Application a WHERE a.status = :status AND a.platform IS NOT NULL GROUP BY a.platform")
    List<Object[]> countByStatusGroupByPlatform(@Param("status") String status);

    // Admin stats: ghost level distribution (levels 1, 2, 3)
    @Query("SELECT a.ghostLevel, COUNT(a) FROM Application a WHERE a.ghostLevel > 0 GROUP BY a.ghostLevel")
    List<Object[]> countByGhostLevel();

    // Admin stats: count apps where role = 'Unknown Role'
    long countByRole(String role);
}
