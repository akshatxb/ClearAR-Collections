package com.clearar.collections.collectionsapp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures table columns supporting JSON or long text payloads are properly sized
 * in MySQL (MEDIUMTEXT) to prevent silent truncation / data-length errors when Hibernate
 * ddl-auto=update does not automatically alter existing column widths.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class DatabaseSchemaFixer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        alterColumnSafely("ALTER TABLE outcome_events MODIFY COLUMN factor_snapshot_json MEDIUMTEXT",
                "ALTER TABLE outcome_events ALTER COLUMN factor_snapshot_json SET DATA TYPE CLOB");
        alterColumnSafely("ALTER TABLE notifications MODIFY COLUMN payload MEDIUMTEXT",
                "ALTER TABLE notifications ALTER COLUMN payload SET DATA TYPE CLOB");
        alterColumnSafely("ALTER TABLE communications MODIFY COLUMN content MEDIUMTEXT",
                "ALTER TABLE communications ALTER COLUMN content SET DATA TYPE CLOB");
        alterColumnSafely("ALTER TABLE disputes MODIFY COLUMN reason TEXT",
                "ALTER TABLE disputes ALTER COLUMN reason SET DATA TYPE CLOB");
        alterColumnSafely("ALTER TABLE co_actor_tasks MODIFY COLUMN notes TEXT",
                "ALTER TABLE co_actor_tasks ALTER COLUMN notes SET DATA TYPE CLOB");
        alterColumnSafely("ALTER TABLE co_actor_tasks MODIFY COLUMN outcome_notes TEXT",
                "ALTER TABLE co_actor_tasks ALTER COLUMN outcome_notes SET DATA TYPE CLOB");
    }

    private void alterColumnSafely(String mysqlSql, String h2Sql) {
        try {
            jdbcTemplate.execute(mysqlSql);
            log.info("Schema update executed successfully: {}", mysqlSql);
        } catch (Exception mysqlEx) {
            try {
                jdbcTemplate.execute(h2Sql);
                log.info("Fallback schema update executed successfully: {}", h2Sql);
            } catch (Exception fallbackEx) {
                log.debug("Schema migration notice (table may not exist or already compatible): {}", mysqlEx.getMessage());
            }
        }
    }
}
