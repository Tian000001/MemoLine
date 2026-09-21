import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Tag,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getEvents, getEvent } from '@/api/events';
import type {
  EventItem,
  EventDetail,
  EventListQuery,
} from '@shared/api.interface';

import {
  SkeletonNode,
  DatePickerField,
  EventDetailView,
  formatDateTime,
} from './TimelineComponents';

const PAGE_SIZE = 10;

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

const TimelinePage = () => {
  const navigate = useNavigate();

  // List
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, EventDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (pageNum: number, reset: boolean) => {
      setLoading(true);
      try {
        const params: EventListQuery = { page: pageNum, pageSize: PAGE_SIZE };
        if (keyword.trim()) params.keyword = keyword.trim();
        if (tagFilter.trim()) params.tag = tagFilter.trim();
        if (locationFilter.trim()) params.location = locationFilter.trim();
        if (startDate) params.startTime = startDate.toISOString();
        if (endDate) params.endTime = endOfDay(endDate).toISOString();
        const res = await getEvents(params);
        setEvents((prev) => (reset ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      } catch {
        // 忽略列表加载错误
      } finally {
        setLoading(false);
      }
    },
    [keyword, tagFilter, locationFilter, startDate, endDate],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchEvents(1, true);
    }, 300);
    return () => clearTimeout(t);
  }, [keyword, tagFilter, locationFilter, startDate, endDate, fetchEvents]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchEvents(next, false);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailMap[id]) {
      setDetailLoadingId(id);
      try {
        const d = await getEvent(id);
        setDetailMap((prev) => ({ ...prev, [id]: d }));
      } catch {
        // 忽略详情加载错误
      } finally {
        setDetailLoadingId(null);
      }
    }
  };

  const handleTagClick = (tag: string) => {
    setTagFilter(tag);
    setFilterOpen(true);
  };

  const clearFilters = () => {
    setKeyword('');
    setTagFilter('');
    setLocationFilter('');
    setStartDate(null);
    setEndDate(null);
  };

  const hasMore = events.length < total && events.length > 0;
  const isEmpty = !loading && events.length === 0;
  const activeFilterCount =
    (tagFilter ? 1 : 0) +
    (locationFilter ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
            事件时间线
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            按时间倒序浏览所有事件记录
          </p>
        </div>
        <Button
          onClick={() => navigate('/new')}
          className="bg-cyan-500 text-slate-900 hover:bg-cyan-400"
        >
          <Plus size={16} />
          新建事件
        </Button>
      </div>

      {/* Search bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={16}
          />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索关键词（描述 / 地点）..."
            className="border-slate-700/50 bg-slate-900/60 pl-9 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setFilterOpen(!filterOpen)}
          className="border-slate-700/50 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
        >
          <Filter size={16} />
          筛选
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1.5 text-xs text-slate-900">
              {activeFilterCount}
            </span>
          )}
          {filterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="grid gap-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">标签</label>
            <div className="relative">
              <Tag
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={14}
              />
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="输入标签名"
                className="border-slate-700/50 bg-slate-900/60 pl-9 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">地点</label>
            <div className="relative">
              <MapPin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={14}
              />
              <Input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="输入地点关键词"
                className="border-slate-700/50 bg-slate-900/60 pl-9 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50"
              />
            </div>
          </div>
          <DatePickerField
            label="开始日期"
            value={startDate}
            onChange={setStartDate}
            placeholder="选择开始日期"
          />
          <DatePickerField
            label="结束日期"
            value={endDate}
            onChange={setEndDate}
            placeholder="选择结束日期"
          />
          {activeFilterCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
                清除所有筛选
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/60" />
        <div className="space-y-6">
          {loading && events.length === 0 && (
            <>
              {[1, 2, 3].map((i) => (
                <SkeletonNode key={i} />
              ))}
            </>
          )}

          {isEmpty && (
            <div className="relative pl-10">
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 py-16 text-center">
                <Clock className="mb-3 text-slate-600" size={32} />
                <p className="text-sm text-slate-400">暂无事件记录</p>
                <p className="mt-1 text-xs text-slate-500">
                  创建你的第一个事件，开始记录时间线
                </p>
                <Button
                  onClick={() => navigate('/new')}
                  className="mt-4 bg-cyan-500 text-slate-900 hover:bg-cyan-400"
                >
                  <Plus size={16} />
                  去创建事件
                </Button>
              </div>
            </div>
          )}

          {events.map((ev) => (
            <div key={ev.id} className="relative pl-10">
              <div
                className={`absolute left-2 top-3 h-4 w-4 rounded-full border-2 transition-colors ${
                  expandedId === ev.id
                    ? 'border-cyan-400 bg-cyan-400 shadow-[0_0_8px_rgba(34_211_238_0.6)]'
                    : 'border-slate-600 bg-slate-800'
                }`}
              />
              <div
                onClick={() => toggleExpand(ev.id)}
                className="cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 transition-all hover:border-slate-600 hover:bg-slate-800"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <Clock size={14} />
                    <span>{formatDateTime(ev.eventTime)}</span>
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={14} />
                      <span>{ev.location}</span>
                    </div>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-200">
                  {ev.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {ev.tags.map((t: string) => (
                      <span
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(t);
                        }}
                        className="flex cursor-pointer items-center gap-1 rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300 transition-colors hover:bg-slate-600/80"
                      >
                        <Tag size={10} />
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ImageIcon size={12} />
                      {ev.mediaCount} 媒体
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {ev.chatRecordCount} 对话
                    </span>
                  </div>
                </div>

                {expandedId === ev.id && (
                  <div className="mt-4 border-t border-slate-700/50 pt-4">
                    {detailLoadingId === ev.id && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2
                          className="animate-spin text-cyan-400"
                          size={20}
                        />
                        <span className="ml-2 text-sm text-slate-400">
                          加载详情...
                        </span>
                      </div>
                    )}
                    {detailMap[ev.id] && (
                      <EventDetailView detail={detailMap[ev.id]} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="mt-6 pl-10">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full border-slate-700/50 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  加载中...
                </>
              ) : (
                '加载更多'
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">
              已加载 {events.length} / {total} 条
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelinePage;
