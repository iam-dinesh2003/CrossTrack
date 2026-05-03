package com.crosstrack.api.repository;

import com.crosstrack.api.model.InterviewNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface InterviewNoteRepository extends JpaRepository<InterviewNote, Long> {
    List<InterviewNote> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<InterviewNote> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);

    @Modifying
    @Transactional
    @Query("DELETE FROM InterviewNote n WHERE n.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
