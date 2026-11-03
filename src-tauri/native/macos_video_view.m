#import <Cocoa/Cocoa.h>

// All calls are made on Tauri's main thread. Coordinates arrive as CSS points
// measured from the upper-left corner of the window content.
static NSRect novus_video_frame(NSView *parent, double x, double y, double width, double height) {
    double origin_y = [parent isFlipped] ? y : NSHeight([parent bounds]) - y - height;
    return NSMakeRect(x, origin_y, width, height);
}

@interface NovusVideoView : NSView
@property(nonatomic, assign) void *inputContext;
@property(nonatomic, assign) void (*onTap)(void *);
@property(nonatomic, assign) void (*onDestroy)(void *);
- (void)videoTapped:(NSClickGestureRecognizer *)recognizer;
@end

@implementation NovusVideoView
- (void)videoTapped:(NSClickGestureRecognizer *)recognizer {
    if (recognizer.state == NSGestureRecognizerStateEnded && self.onTap != NULL)
        self.onTap(self.inputContext);
}
- (void)dealloc {
    if (self.onDestroy != NULL) self.onDestroy(self.inputContext);
    [super dealloc];
}
@end

void *novus_mpv_create_view(void *parent_pointer, double x, double y, double width, double height,
                            void *context, void (*on_tap)(void *), void (*on_destroy)(void *)) {
    NSView *parent = (NSView *)parent_pointer;
    if (parent == nil) return NULL;

    NovusVideoView *view = [[NovusVideoView alloc] initWithFrame:novus_video_frame(parent, x, y, width, height)];
    if (view == nil) return NULL;
    view.inputContext = context;
    view.onTap = on_tap;
    view.onDestroy = on_destroy;
    NSClickGestureRecognizer *click = [[NSClickGestureRecognizer alloc] initWithTarget:view action:@selector(videoTapped:)];
    [view addGestureRecognizer:click];
    [click release];
    [parent addSubview:view];
    [view release]; // The parent retains the view until novus_mpv_destroy_view.
    return view;
}

void novus_mpv_resize_view(void *view_pointer, double x, double y, double width, double height) {
    NSView *view = (NSView *)view_pointer;
    NSView *parent = [view superview];
    if (parent != nil) [view setFrame:novus_video_frame(parent, x, y, width, height)];
}

void novus_mpv_destroy_view(void *view_pointer) {
    NSView *view = (NSView *)view_pointer;
    [view removeFromSuperview];
}
