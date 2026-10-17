package com.clearar.collections.collectionsapp.repository;

import com.clearar.collections.collectionsapp.entity.CoActorTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoActorTaskRepository extends JpaRepository<CoActorTask, Long> {
    List<CoActorTask> findByAssignedTo(Long userId);
    List<CoActorTask> findByAccountIdIn(List<Long> accountIds);
}
