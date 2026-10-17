package com.clearar.collections.collectionsapp.dto;

import lombok.Data;

/** P1 #30 -- Relationship Owner marks a co-actor task done (or otherwise updates status), with notes on what happened. */
@Data
public class CoActorTaskUpdateRequest {
    private String status;       // e.g. "done"
    private String outcomeNotes; // free-text on what the relationship owner did / found
}
