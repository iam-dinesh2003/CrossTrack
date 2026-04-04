import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';
import { GripVertical, ExternalLink, Search, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as applicationService from '../../services/applicationService';

const COLUMNS = [
  { id: 'APPLIED', label: 'Applied', color: 'border-l-indigo-500', bg: 'bg-indigo-50/50', badge: 'bg-gradient-to-r from-indigo-500 to-indigo-600', headerBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50', dot: 'bg-indigo-500' },
  { id: 'INTERVIEW', label: 'Interview', color: 'border-l-emerald-500', bg: 'bg-emerald-50/50', badge: 'bg-gradient-to-r from-emerald-500 to-emerald-600', headerBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', dot: 'bg-emerald-500' },
  { id: 'OFFER', label: 'Offer', color: 'border-l-cyan-500', bg: 'bg-cyan-50/50', badge: 'bg-gradient-to-r from-cyan-500 to-cyan-600', headerBg: 'bg-gradient-to-br from-cyan-50 to-cyan-100/50', dot: 'bg-cyan-500' },
  { id: 'REJECTED', label: 'Rejected', color: 'border-l-rose-500', bg: 'bg-rose-50/50', badge: 'bg-gradient-to-r from-rose-500 to-rose-600', headerBg: 'bg-gradient-to-br from-rose-50 to-rose-100/50', dot: 'bg-rose-500' },
  { id: 'GHOSTED', label: 'Ghosted', color: 'border-l-gray-400', bg: 'bg-gray-50/50', badge: 'bg-gradient-to-r from-gray-400 to-gray-500', headerBg: 'bg-gradient-to-br from-gray-50 to-gray-100/50', dot: 'bg-gray-400' },
];

const CARDS_PER_PAGE = 10;

function DraggableCard({ app, compact, column }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id.toString(),
    data: { status: app.status },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  if (compact) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}
        className={clsx(
          'bg-white rounded-xl px-3 py-2.5 border border-gray-100/80 shadow-sm hover:shadow-md transition-all cursor-grab border-l-2',
          column.color,
          isDragging && 'opacity-30'
        )}>
        <div className="flex items-center gap-2">
          <GripVertical size={12} className="text-gray-300 shrink-0" />
          <span className="text-xs font-semibold text-gray-800 truncate">{app.role}</span>
          <span className="text-[10px] text-gray-400 truncate">@ {app.company}</span>
          {app.url && (
            <a href={app.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="ml-auto text-gray-300 hover:text-indigo-500 transition shrink-0">
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={clsx(
        'bg-white rounded-xl p-3.5 border border-gray-100/80 shadow-sm hover:shadow-md transition-all cursor-grab border-l-2',
        column.color,
        isDragging && 'opacity-30'
      )}>
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 text-gray-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{app.role}</p>
          <p className="text-xs text-gray-500 mt-0.5">{app.company}</p>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[10px] text-gray-400 font-medium">
              {app.appliedAt ? format(new Date(app.appliedAt), 'MMM d') : ''}
            </span>
            {app.url && (
              <a href={app.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-gray-300 hover:text-indigo-500 transition">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, apps, compact }) {
  const [expanded, setExpanded] = useState(false);
  const visibleApps = expanded ? apps : apps.slice(0, CARDS_PER_PAGE);
  const hasMore = apps.length > CARDS_PER_PAGE && !expanded;

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex-1 min-w-[240px]">
      <div className={clsx(
        'rounded-2xl overflow-hidden border shadow-sm transition-all duration-200',
        isOver ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-lg scale-[1.01]' : 'border-gray-100/80'
      )}>
        {/* Column Header */}
        <div className={clsx('px-4 py-3.5', column.headerBg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={clsx('w-2.5 h-2.5 rounded-full shadow-sm', column.dot)} />
              <h3 className="text-sm font-bold text-gray-700">{column.label}</h3>
            </div>
            <span className={clsx('text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full shadow-sm', column.badge)}>
              {apps.length}
            </span>
          </div>
        </div>

        {/* Droppable Cards Area */}
        <div ref={setNodeRef} className={clsx('p-3 min-h-[120px] transition-colors duration-200', isOver ? 'bg-indigo-50/40' : 'bg-gray-50/30')}>
          <div className={clsx('space-y-2', compact && 'space-y-1.5')}>
            {visibleApps.map(app => (
              <DraggableCard key={app.id} app={app} compact={compact} column={column} />
            ))}
            {apps.length === 0 && (
              <div className={clsx(
                'text-xs text-center py-10 border-2 border-dashed rounded-xl transition-all duration-200',
                isOver
                  ? 'border-indigo-300 bg-indigo-50/80 text-indigo-500 font-medium'
                  : 'border-gray-200/80 bg-white/50 text-gray-400'
              )}>
                {isOver ? 'Release to drop' : 'Drop here'}
              </div>
            )}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full mt-2.5 py-2 text-xs text-gray-500 hover:text-indigo-600 bg-white/80 hover:bg-white rounded-xl transition-all flex items-center justify-center gap-1 font-medium border border-gray-100/50"
            >
              <ChevronDown size={12} /> Show {apps.length - CARDS_PER_PAGE} more
            </button>
          )}
          {expanded && apps.length > CARDS_PER_PAGE && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full mt-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition font-medium"
            >
              Show less
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom collision detection: find which column the dragged item is over
function findDropColumn(args) {
  const { droppableContainers, active, collisionRect } = args;
  if (!collisionRect || !active) return [];

  const collisions = [];
  for (const container of droppableContainers) {
    const rect = container.rect.current;
    if (!rect) continue;

    // Check if the center of the dragged item is within this droppable
    const centerX = collisionRect.left + collisionRect.width / 2;
    const centerY = collisionRect.top + collisionRect.height / 2;

    if (
      centerX >= rect.left &&
      centerX <= rect.right &&
      centerY >= rect.top &&
      centerY <= rect.bottom
    ) {
      collisions.push({ id: container.id, data: { droppableContainer: container } });
    }
  }

  return collisions;
}

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [compact, setCompact] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => applicationService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: () => {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.error('Failed to update status');
    },
  });

  // Filter by date range
  const now = new Date();
  const dateFilteredApps = applications.filter(app => {
    if (dateRange === 'all') return true;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return new Date(app.appliedAt) >= cutoff;
  });

  // Filter by search
  const filteredApps = dateFilteredApps.filter(app => {
    if (!search) return true;
    const q = search.toLowerCase();
    return app.company.toLowerCase().includes(q) || app.role.toLowerCase().includes(q);
  });

  const getColumnApps = (status) => filteredApps.filter(a => a.status === status);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeAppId = active.id;
    const currentStatus = active.data?.current?.status;
    const targetStatus = over.id; // over.id is the column id (APPLIED, INTERVIEW, etc.)

    // Only columns are droppable, so over.id is always a column status
    const isValidColumn = COLUMNS.some(c => c.id === targetStatus);
    if (!isValidColumn) return;

    if (targetStatus && targetStatus !== currentStatus) {
      // Optimistically update the UI
      queryClient.setQueryData(['applications'], (old) =>
        old?.map(app =>
          app.id.toString() === activeAppId ? { ...app, status: targetStatus } : app
        )
      );
      updateStatusMutation.mutate({ id: parseInt(activeAppId), status: targetStatus });
      toast.success(`Moved to ${COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeApp = activeId ? applications.find(a => a.id.toString() === activeId) : null;
  const totalShowing = filteredApps.length;
  const totalAll = applications.length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search company or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition shadow-sm"
          />
        </div>

        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 shadow-sm cursor-pointer"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>

        <button
          onClick={() => setCompact(!compact)}
          className={clsx(
            'flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm border transition-all font-medium',
            compact
              ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
              : 'bg-white border-gray-200/80 text-gray-600 hover:bg-gray-50 shadow-sm'
          )}
          title={compact ? 'Switch to default view' : 'Switch to compact view'}
        >
          {compact ? <List size={14} /> : <LayoutGrid size={14} />}
          {compact ? 'Compact' : 'Default'}
        </button>

        <span className="text-xs text-gray-400 ml-auto font-medium">
          Showing {totalShowing} of {totalAll}
        </span>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={findDropColumn}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <KanbanColumn key={col.id} column={col} apps={getColumnApps(col.id)} compact={compact} />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeApp ? (
            <div className="bg-white rounded-xl p-3.5 border-2 border-indigo-300 shadow-2xl shadow-indigo-200/50 w-[240px] rotate-2">
              <p className="text-sm font-semibold text-gray-800 truncate">{activeApp.role}</p>
              <p className="text-xs text-gray-500">{activeApp.company}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
