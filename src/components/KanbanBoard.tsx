'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent, defaultDropAnimationSideEffects, DropAnimation, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Order } from '@/lib/excel';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

interface KanbanBoardProps {
    orders: Order[];
    steps: string[];
    selectedProductId: string;
    onStatusChange: (woId: string, step: string, status: string) => Promise<void>;
    highlightedWos?: string[];
    onOrderClick?: (woId: string) => void;
    stepQuantities?: Record<string, number>;
}

// Helper to safely get order data (handles both nested .data and flattened structures)
function safeParseData(order: Order): Record<string, any> {
    if (!order) return {};

    // Case 1: If order.data exists as a string (from raw DB), parse it
    if (typeof order.data === 'string') {
        try {
            return JSON.parse(order.data);
        } catch (e) {
            console.error("Failed to parse order.data", order.id, e);
            return {};
        }
    }

    // Case 2: If order.data exists as an object, return it
    if (order.data && typeof order.data === 'object') {
        return order.data;
    }

    // Case 3: API may have flattened data directly onto order object
    // Return the order itself (it has step values as top-level properties)
    return order;
}

// Helper: Determine which column (Step) an order belongs to.
function getOrderColumn(order: Order, steps: string[]): string {
    const data = safeParseData(order);

    for (const step of steps) {
        const val = data[step];
        const isSkipped = val === 'N/A';

        // A step is considered "completed" if it has a value (truthy)
        // AND that value is NOT one of the active/pending/skipped statuses.
        // This accepts dates ("15-Jan"), "Done", "Completed", etc.
        const isCompleted = val && !['Hold', 'QN', 'P', 'WIP', 'DIFA', 'N/A'].includes(val);

        if (!isCompleted && !isSkipped) {
            return step;
        }
    }
    return 'COMPLETED_COLUMN';
}

const KanbanCard = ({ order, status, isOverlay, columnWidth, onClick, disabled }: { order: Order; status: string; isOverlay?: boolean; columnWidth: number; onClick?: () => void; disabled?: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: order.id,
        data: { type: 'Order', order },
        disabled
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    // Parse status for color to match getStatusStyle in operation page
    let statusColor = 'bg-white border-l-4 border-slate-300 text-slate-600';
    const v = (status || '').toUpperCase();

    if (v.startsWith('P')) {
        statusColor = 'bg-[#0014DC] text-white border-l-4 border-blue-800 shadow-blue-100';
    } else if (v === 'WIP') {
        statusColor = 'bg-yellow-100 text-yellow-900 border-l-4 border-yellow-500 shadow-yellow-50';
    } else if (v === 'HOLD') {
        statusColor = 'bg-orange-100 text-orange-900 border-l-4 border-orange-500 shadow-orange-50';
    } else if (v === 'QN' || v === 'DIFA') {
        statusColor = 'bg-red-100 text-red-900 border-l-4 border-red-500 shadow-red-50';
    } else if (v === 'DONE' || v === 'COMPLETED' || /\d{4}-\d{2}-\d{2}/.test(status)) {
        statusColor = 'bg-green-100 text-green-900 border-l-4 border-green-500 shadow-green-50';
    } else if (v === 'N/A') {
        statusColor = 'bg-slate-100 text-slate-500 border-l-4 border-slate-300';
    }

    const Wrapper = isOverlay ? 'div' : 'div';

    // Safety check for WO ID
    const woId = order['WO ID'] || order.id || 'Unknown';

    // Responsive font size based on column width
    const fontSize = columnWidth < 280 ? 'text-xs' : columnWidth < 350 ? 'text-sm' : 'text-base';

    return (
        <Wrapper
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`p-3 rounded-lg shadow-sm border border-slate-200 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none ${statusColor} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400/50' : ''}`}
        >
            <div className="flex justify-between items-start mb-1">
                <span className={`font-extrabold ${fontSize} ${v.startsWith('P') ? 'text-white' : 'text-slate-900'}`}>{woId}</span>
                {order.Priority === 'Urgent' && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
            </div>
            <div className={`text-xs truncate ${v.startsWith('P') ? 'text-blue-50' : 'text-slate-500'}`} title={order.Description || ''}>
                {order.Description || 'No description'}
            </div>
            <div className={`mt-2 flex justify-between items-center text-[10px] font-mono ${v.startsWith('P') ? 'text-blue-100' : 'text-slate-500'}`}>
                <span className="truncate">{order.PN}</span>
                {status && <span className="uppercase font-bold flex-shrink-0 ml-1">{status}</span>}
            </div>
        </Wrapper>
    );
};

const KanbanColumn = ({
    id,
    title,
    orders,
    isOver,
    width,
    onResize,
    onCardClick,
    dragDisabled
}: {
    id: string;
    title: string;
    orders: Order[];
    isOver: boolean;
    width: number;
    onResize: (newWidth: number) => void;
    onCardClick?: (woId: string) => void;
    dragDisabled?: boolean;
}) => {
    const { setNodeRef } = useDroppable({ id });
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = React.useRef(0);
    const startWidthRef = React.useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = width;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startXRef.current;
            const newWidth = Math.max(150, Math.min(600, startWidthRef.current + delta));
            onResize(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={setNodeRef}
            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
            className={`flex-shrink-0 flex flex-col h-full rounded-xl transition-colors relative ${isOver ? 'bg-indigo-50' : 'bg-slate-50'}`}
        >
            <div className="p-3 font-semibold text-slate-700 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-inherit rounded-t-xl z-10">
                <span className="truncate">{title}</span>
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                    {orders.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                <SortableContext items={orders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                    {orders.map(order => {
                        const data = safeParseData(order);
                        const status = id === 'COMPLETED_COLUMN' ? 'Done' : (data[id] || '');
                        return <KanbanCard
                            key={order.id}
                            order={order}
                            status={status}
                            columnWidth={width}
                            onClick={() => onCardClick?.(order['WO ID'] || order.id)}
                            disabled={dragDisabled}
                        />;
                    })}
                </SortableContext>
                {orders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-lg m-2 min-h-[100px]">
                        <span className="text-xs">Empty</span>
                    </div>
                )}
            </div>

            {/* Resize handle */}
            <div
                className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors ${isResizing ? 'bg-indigo-500' : 'bg-transparent'}`}
                onMouseDown={handleMouseDown}
                title="Drag to resize all columns"
            />
        </div>
    );
};

export default function KanbanBoard({ orders, steps, onStatusChange, onOrderClick, stepQuantities }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overColumnId, setOverColumnId] = useState<string | null>(null);
    const [columnWidth, setColumnWidth] = useState(320); // Default width

    // Sensors with activation constraints to prevent accidental drags vs clicks
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    // Persist column width
    useEffect(() => {
        const saved = localStorage.getItem('kanban_column_width');
        if (saved) {
            const w = parseInt(saved);
            if (!isNaN(w) && w >= 150 && w <= 600) {
                // eslint-disable-next-line
                setColumnWidth(w);
            }
        }
    }, []);

    // Group orders by column
    const columns = useMemo(() => {
        const cols: Record<string, Order[]> = {};
        steps.forEach(s => cols[s] = []);
        cols['COMPLETED_COLUMN'] = [];

        // Debug: Log first order to understand data structure
        if (orders.length > 0) {
            const sample = orders[0];
            console.log('[Kanban] Sample order structure:', {
                id: sample.id,
                woId: sample.woId,
                'WO ID': sample['WO ID'],
                hasData: !!sample.data,
                dataType: typeof sample.data,
                steps: steps.map(s => ({ step: s, value: sample[s] }))
            });
        }

        orders.forEach(order => {
            const colId = getOrderColumn(order, steps);
            if (cols[colId]) {
                cols[colId].push(order);
            } else {
                // Should not happen if steps are synced, but fallback
                if (!cols[colId]) cols[colId] = [];
                cols[colId].push(order);
            }
        });

        // Debug: Log column distribution
        console.log('[Kanban] Column distribution:', Object.fromEntries(
            Object.entries(cols).map(([k, v]) => [k, v.length])
        ));

        return cols;
    }, [orders, steps]);

    // Finds the step index
    const getStepIndex = (stepId: string) => {
        if (stepId === 'COMPLETED_COLUMN') return steps.length;
        return steps.indexOf(stepId);
    };

    const handleDragStart = (event: DragStartEvent) => {
        console.log('[Kanban] Drag Start:', event.active.id);
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: { active: any; over: any }) => {
        const { over } = event;
        if (!over) {
            setOverColumnId(null);
            return;
        }
        // Determine which column is being hovered
        let columnId = over.id as string;
        if (!steps.includes(columnId) && columnId !== 'COMPLETED_COLUMN') {
            // over.id is a card, find its column
            const overOrder = orders.find(o => o.id === columnId);
            if (overOrder) {
                columnId = getOrderColumn(overOrder, steps);
            }
        }
        setOverColumnId(columnId);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        console.log('[Kanban] Drag End:', { activeId: active.id, overId: over?.id });
        setActiveId(null);
        setOverColumnId(null);

        if (!over) return;

        const activeOrder = orders.find(o => o.id === active.id);
        if (!activeOrder) return;

        const fromColumnId = getOrderColumn(activeOrder, steps);
        const toColumnId = over.id as string; // Could be column ID or card ID

        // If dropped on a card, find that card's column
        let targetColumnId = toColumnId;
        if (!steps.includes(toColumnId) && toColumnId !== 'COMPLETED_COLUMN') {
            // Must be a card ID, find which column it belongs to (via order lookup or parent?)
            // Simplification: In KanbanColumn, `over.id` is the Droppable ID (the column) because Sortable items bubble up? 
            // dnd-kit Sortable: over.id is the unique ID of the item over.
            // We need to resolve the column.
            const overOrder = orders.find(o => o.id === toColumnId);
            if (overOrder) {
                targetColumnId = getOrderColumn(overOrder, steps);
            } else {
                // If dropped on empty space of a column, over.id is the column ID.
                // So if not a step, and not a card (already checked), it's weird.
                // But `steps.includes` check above covers step IDs.
                // We assume `targetColumnId` is valid step or 'COMPLETED_COLUMN'.
            }
        }

        if (fromColumnId === targetColumnId) {
            return; // No column change
        }

        // Logic for move
        const fromIndex = getStepIndex(fromColumnId);
        const toIndex = getStepIndex(targetColumnId);

        if (toIndex > fromIndex) {
            // Moving Forward: Mark FROM steps as Done.
            // Kanban usually implies moving one step right.
            // If we jump multiple, we might want to fill gaps?
            // For now, let's just mark the `fromColumnId` step as 'Done'.
            // This will naturally push it to `fromColumnId + 1`.
            // If target is further ahead, we might need loops.
            // SAFE MODE: Only process the step of the column we left.
            // "I moved it out of Step 1". So Step 1 is Done.

            // Wait, if I drag from Step 1 to Step 3.
            // Step 1 needs to be Done. Step 2?
            // If I just mark Step 1 Done, getOrderColumn will say "Step 2". So it lands in Step 2.
            // If user wanted Step 3, they'd have to drag again?
            // User Experience: If I drop in Step 3, I expect it in Step 3.
            // This implies Step 1 AND Step 2 are Done.
            // Let's implement multi-step completion if needed?
            // "Absolutely must not affect existing functionality" -> Logic-wise, filling gaps is risky if unintentional.
            // Let's stick to "Mark Previous Step as Done".
            // So if I drag Step 1 -> Step 2. complete(Step 1).
            // If I drag Step 1 -> Step 3. complete(Step 1) AND complete(Step 2)?
            // Let's just do `complete(steps[toIndex - 1])`? No.

            // Robust logic:
            // Iterate from `fromIndex` to `toIndex - 1`. Mark all as Done.
            for (let i = fromIndex; i < toIndex; i++) {
                const stepToComplete = steps[i];
                console.log('[Kanban] Completing step:', stepToComplete);
                // Use woId (database field) or fall back to 'WO ID' from data
                const woIdForApi = activeOrder.woId || activeOrder['WO ID'];
                await onStatusChange(woIdForApi, stepToComplete, 'Done');
            }
        } else {
            // Moving Backward: Reset steps.
            // If I move from Step 3 to Step 1.
            // Step 1 should be active. So Step 1 is NOT DONE. Step 2 is NOT DONE.
            // So Reset: Step 1, Step 2.
            // Iterate from `toIndex` to `fromIndex`. Reset all?
            // Wait. Column = Step means "Pending Step".
            // Step 1 Column = Step 1 is NOT DONE.
            // Step 3 Column = Step 1 Done, Step 2 Done, Step 3 NOT DONE.
            // Moving to Step 1: Means Step 1 must become NOT DONE.
            // Logic: Reset `step[i]` for i = `toIndex` to `fromIndex - 1`?
            // Actually, if I move to Step 1, Step 0 (if valid) is done. Step 1 should be reset.
            // Also all subsequent steps (Step 2) are definitely reset or just ignored? 
            // In linear flow, if Step 1 is pending, Step 2 is irrelevant.
            // So we loop `i` from `toIndex` up to `steps.length`? Or just up to `fromIndex`.
            // Let's just loop from `toIndex` to `fromIndex`. Set status 'Reset'.

            for (let i = toIndex; i <= fromIndex; i++) { // careful with indices
                // `fromColumnId` was active, so `steps[fromIndex]` is currently empty.
                // We are moving to `toIndex`. So `steps[toIndex]` must become empty.
                // And any steps in between that were Done must also be reset.
                // E.g. Step 3 (Active) -> Move to Step 1.
                // Step 1 was Done. Now must be Empty.
                // Step 2 was Done. Now must be Empty.
                // Step 3 was Empty. Still Empty.

                // So we iterate `i` from `toIndex` to `fromIndex - 1`.
                // steps[fromIndex] is already empty.

                if (i < steps.length) {
                    const stepToReset = steps[i];
                    const woIdForApi = activeOrder.woId || activeOrder['WO ID'];
                    await onStatusChange(woIdForApi, stepToReset, 'Reset');
                }
            }
        }
    };

    const handleResize = (newWidth: number) => {
        setColumnWidth(newWidth);
        localStorage.setItem('kanban_column_width', newWidth.toString());
    };

    const activeOrder = activeId ? orders.find(o => o.id === activeId) : null;
    const activeStatus = activeOrder && activeId ? 'Dragging' : ''; // simplified

    // Drop Animation Customization
    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} sensors={sensors}>
            <div className="flex h-[calc(100vh-200px)] overflow-x-auto gap-4 px-2 pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                {steps.map(step => (
                    <KanbanColumn
                        key={step}
                        id={step}
                        title={step}
                        orders={columns[step]}
                        isOver={overColumnId === step}
                        width={columnWidth}
                        onResize={handleResize}
                        onCardClick={onOrderClick}
                        dragDisabled={!!stepQuantities?.[step]}
                    />
                ))}
                <KanbanColumn
                    id="COMPLETED_COLUMN"
                    title="Completed"
                    orders={columns['COMPLETED_COLUMN']}
                    isOver={overColumnId === 'COMPLETED_COLUMN'}
                    width={columnWidth}
                    onResize={handleResize}
                    onCardClick={onOrderClick}
                />
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeOrder ? (
                    <div className="transform rotate-3 cursor-grabbing">
                        <KanbanCard order={activeOrder} status={activeStatus} isOverlay columnWidth={columnWidth} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
