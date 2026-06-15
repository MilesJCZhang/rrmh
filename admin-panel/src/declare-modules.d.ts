declare module 'dayjs' {
  import dayjs from 'dayjs';
  export = dayjs;
}

declare module 'dayjs/plugin/*' {
  const plugin: any;
  export = plugin;
}
