package com.crosstrack.api.repository;

import com.crosstrack.api.model.FollowUpReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

public interface FollowUpReminderRepository extends JpaRepository<FollowUpReminder, Long> {
    List<FollowUpReminder> findByUserIdAndStatusOrderByDueDateAsc(Long userId, String status);
    List<FollowUpReminder> findByUserIdAndStatusInOrderByDueDateAsc(Long userId, List<String> statuses);
    List<FollowUpReminder> findByApplicationId(Long applicationId);
    boolean existsByApplicationIdAndType(Long applicationId, String type);
    List<FollowUpReminder> findByStatusAndDueDateLessThanEqual(String status, LocalDate date);

    @Modifying
    @Transactional
    @Query("DELETE FROM FollowUpReminder r WHERE r.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
