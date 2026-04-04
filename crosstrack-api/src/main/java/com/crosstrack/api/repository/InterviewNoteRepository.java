package com.crosstrack.api.repository;

import com.crosstrack.api.model.InterviewNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InterviewNoteRepository extends JpaRepository<InterviewNote, Long> {
    List<InterviewNote> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<InterviewNote> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);
}
