package com.crosstrack.api.repository;

import com.crosstrack.api.model.GmailAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GmailAccountRepository extends JpaRepository<GmailAccount, Long> {

    List<GmailAccount> findByUserIdAndConnectedTrue(Long userId);

    List<GmailAccount> findByUserId(Long userId);

    Optional<GmailAccount> findByUserIdAndGmailEmail(Long userId, String gmailEmail);

    Optional<GmailAccount> findByIdAndUserId(Long id, Long userId);
}
