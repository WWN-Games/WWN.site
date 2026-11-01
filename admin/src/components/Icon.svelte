<script lang="ts">
  interface Props {
    name: string;
    size?: number;
  }

  const { name, size = 18 }: Props = $props();

  const paths: Record<string, string[]> = {
    dashboard: ["M4 4h6v6H4z", "M14 4h6v10h-6z", "M4 14h6v6H4z", "M14 18h6v2h-6z"],
    article: ["M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z", "M8 8h7", "M8 12h7", "M8 16h4"],
    cube: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"],
    building: ["M5 21V5l7-2v18", "M12 21h7V9l-7-3", "M8 7v.01", "M8 11v.01", "M8 15v.01", "M16 12v.01", "M16 16v.01"],
    shield: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
    tag: ["M20 12l-8 8-8-8V4h8z", "M8.5 8.5h.01"],
    layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5", "M3 17l9 5 9-5"],
    check: ["M20 6L9 17l-5-5"],
    checkCircle: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M8 12l3 3 5-5"],
    git: ["M6 3v12", "M18 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 9v3a3 3 0 0 1-3 3H9"],
    plus: ["M12 5v14", "M5 12h14"],
    search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
    trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 14h10l1-14", "M10 11v6", "M14 11v6"],
    copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
    save: ["M5 3h12l3 3v15H5z", "M8 3v6h8V3", "M8 21v-7h8v7"],
    external: ["M14 4h6v6", "M20 4l-9 9", "M20 14v6H4V4h6"],
    refresh: ["M20 11a8 8 0 1 0-2 6", "M20 5v6h-6"],
    chevron: ["M9 6l6 6-6 6"],
    image: ["M4 5h16v14H4z", "M4 15l5-5 4 4 3-3 4 4", "M15.5 8.5h.01"],
    close: ["M6 6l12 12", "M18 6L6 18"],
    warning: ["M12 3l9 17H3z", "M12 9v5", "M12 17v.01"],
    arrowLeft: ["M19 12H5", "M11 6l-6 6 6 6"],
    eye: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
    menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
    link: ["M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"],
    edit: ["M4 20h4L20 8l-4-4L4 16z", "M13 7l4 4"],
    dots: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
    clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 7v5l3 2"],
    folder: ["M3 6h7l2 2h9v11H3z"],
  };

  const shape = $derived(paths[name] ?? paths.dashboard ?? []);
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each shape as d}
    <path {d} />
  {/each}
</svg>
