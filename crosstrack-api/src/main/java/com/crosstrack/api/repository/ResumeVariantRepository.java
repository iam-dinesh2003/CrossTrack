package com.crosstrack.api.repository;

import com.crosstrack.api.model.ResumeVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ResumeVariantRepository extends JpaRepository<ResumeVariant, Long> {
    List<ResumeVariant> findByUserId(Long userId);
    Optional<ResumeVariant> findByUserIdAndIsDefaultTrue(Long userId);
    long countByUserId(Long userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM ResumeVariant r WHERE r.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    // Admin stats: count distinct users who have uploaded at least one resume
    @Query("SELECT COUNT(DISTINCT r.user.id) FROM ResumeVariant r")
    long countDistinctUsers();
}
