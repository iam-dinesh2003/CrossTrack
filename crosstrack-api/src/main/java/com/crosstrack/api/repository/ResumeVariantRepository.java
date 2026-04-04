package com.crosstrack.api.repository;

import com.crosstrack.api.model.ResumeVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ResumeVariantRepository extends JpaRepository<ResumeVariant, Long> {
    List<ResumeVariant> findByUserId(Long userId);
    Optional<ResumeVariant> findByUserIdAndIsDefaultTrue(Long userId);
}
