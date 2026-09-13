"use client";
import { useId, createContext, useContext, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
const Ordering = createContext<{
  ids: string[];
  onOrder: (ids: string[]) => void;
}>({ ids: [], onOrder: () => {} });
export function SortableBundleList({
  ids,
  onOrder,
  children,
  className,
}: {
  ids: string[];
  onOrder: (ids: string[]) => void;
  children: ReactNode;
  className?: string;
}) {
  const contextId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <Ordering.Provider value={{ ids, onOrder }}>
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const from = ids.indexOf(String(active.id)),
              to = ids.indexOf(String(over.id));
            if (from >= 0 && to >= 0) onOrder(arrayMove(ids, from, to));
          }
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={className}>{children}</ul>
        </SortableContext>
      </DndContext>
    </Ordering.Provider>
  );
}
export function SortableMember({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const { ids, onOrder } = useContext(Ordering);
  const index = ids.indexOf(id);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={className}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`Reorder ${label}`}
          className="touch-none rounded p-1 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex flex-col">
          <button
            type="button"
            aria-label={`Move ${label} earlier`}
            disabled={index <= 0}
            onClick={() => onOrder(arrayMove(ids, index, index - 1))}
            className="rounded disabled:opacity-25 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} later`}
            disabled={index < 0 || index >= ids.length - 1}
            onClick={() => onOrder(arrayMove(ids, index, index + 1))}
            className="rounded disabled:opacity-25 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      {children}
    </li>
  );
}
