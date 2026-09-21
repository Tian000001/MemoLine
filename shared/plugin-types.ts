// ---- plugin:timeline_event_review_analysis_1 ----
// ============================================================
// 插件 timeline_event_review_analysis_1 (时间线事件智能复盘分析) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface TimelineEventReviewAnalysisOneInput {
  /** 待分析的时间线事件完整内容 */
  event_timeline_content: string;
  /** 额外的分析要求（可选） */
  additional_analysis_requirements?: string;
}

/**
 * capabilityClient.load('timeline_event_review_analysis_1').callStream<TimelineEventReviewAnalysisOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 TimelineEventReviewAnalysisOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.response ?? ''; }
 */
export interface TimelineEventReviewAnalysisOneOutput {
  /** [object Object] */
  response?: string;
  /** [object Object] */
  content: string;
}
// ---- end:timeline_event_review_analysis_1 ----