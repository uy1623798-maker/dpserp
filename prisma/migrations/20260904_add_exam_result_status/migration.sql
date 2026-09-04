-- Preserve normal scores while recording when a student did not sit the exam.
ALTER TABLE exam_results
  ADD COLUMN result_status text NOT NULL DEFAULT 'Marked';

ALTER TABLE exam_results
  ADD CONSTRAINT exam_results_result_status_check
  CHECK (result_status IN ('Marked', 'Absent'));
