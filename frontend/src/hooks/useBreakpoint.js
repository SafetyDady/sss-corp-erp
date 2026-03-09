import { Grid } from 'antd';

/**
 * Responsive breakpoint hook — wraps Ant Design's Grid.useBreakpoint().
 *
 * Ant Design breakpoints:
 *   xs: 0      (phone portrait)
 *   sm: 576px  (phone landscape)
 *   md: 768px  (tablet portrait)
 *   lg: 992px  (tablet landscape / small desktop)
 *   xl: 1200px (desktop)
 *   xxl: 1600px (large desktop)
 *
 * Convenience booleans:
 *   isMobile:  < 768px  (xs, sm)
 *   isTablet:  768-991px (md only)
 *   isDesktop: >= 992px (lg+)
 */
export default function useBreakpoint() {
  const screens = Grid.useBreakpoint();
  return {
    isMobile: !screens.md,
    isTablet: !!screens.md && !screens.lg,
    isDesktop: !!screens.lg,
    ...screens,
  };
}
