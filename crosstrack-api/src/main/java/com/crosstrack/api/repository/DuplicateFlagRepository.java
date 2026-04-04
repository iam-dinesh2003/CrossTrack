package com.crosstrack.api.repository;

import com.crosstrack.api.model.DuplicateFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DuplicateFlagRepository extends JpaRepository<DuplicateFlag, Long> {
    List<DuplicateFlag> findByApplication1IdOrApplication2Id(Long appId1, Long appId2);

    @Modifying
    @Query("DELETE FROM DuplicateFlag df WHERE df.application1.user.id = :userId OR df.application2.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
