package com.crosstrack.api.repository;

import com.crosstrack.api.model.CoachMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface CoachMessageRepository extends JpaRepository<CoachMessage, Long> {
    List<CoachMessage> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<CoachMessage> findByUserIdAndSessionIdOrderByCreatedAtAsc(Long userId, String sessionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CoachMessage m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
