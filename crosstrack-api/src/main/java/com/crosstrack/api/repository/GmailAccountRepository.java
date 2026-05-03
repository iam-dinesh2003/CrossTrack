package com.crosstrack.api.repository;

import com.crosstrack.api.model.GmailAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface GmailAccountRepository extends JpaRepository<GmailAccount, Long> {

    List<GmailAccount> findByUserIdAndConnectedTrue(Long userId);

    List<GmailAccount> findByUserId(Long userId);

    Optional<GmailAccount> findByUserIdAndGmailEmail(Long userId, String gmailEmail);

    Optional<GmailAccount> findByIdAndUserId(Long id, Long userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM GmailAccount g WHERE g.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
