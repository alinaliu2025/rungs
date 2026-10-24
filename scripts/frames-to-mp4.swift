// Stitches timestamped JPEG frames into an H.264 MP4 using AVFoundation
// (built into macOS, so no ffmpeg needed).
//
//   swift scripts/frames-to-mp4.swift <frames.tsv> <out.mp4>
//
// frames.tsv lines: "<jpeg path>\t<seconds>", plus a final "END\t<seconds>"
// line so the last frame is held until the recording ended. Frames only
// arrive when the screen changes, so the result is variable frame rate.
import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count == 3 else { fatalError("usage: frames-to-mp4 <frames.tsv> <out.mp4>") }

var frames: [(path: String, ms: Int)] = []
var endMs = 0
for line in try String(contentsOfFile: args[1], encoding: .utf8).split(separator: "\n") {
  let parts = line.split(separator: "\t")
  guard parts.count == 2, let t = Double(parts[1]) else { continue }
  if parts[0] == "END" { endMs = Int(t * 1000) } else { frames.append((String(parts[0]), Int(t * 1000))) }
}
guard !frames.isEmpty else { fatalError("no frames") }

func load(_ path: String) -> CGImage {
  let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
  return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}

let first = load(frames[0].path)
let width = first.width & ~1, height = first.height & ~1
let out = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: out)

let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 3_000_000],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func pixels(_ image: CGImage) -> CVPixelBuffer {
  var buffer: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
  let b = buffer!
  CVPixelBufferLockBaseAddress(b, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(b), width: width, height: height, bitsPerComponent: 8,
                      bytesPerRow: CVPixelBufferGetBytesPerRow(b), space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  CVPixelBufferUnlockBaseAddress(b, [])
  return b
}

func append(_ buffer: CVPixelBuffer, _ ms: Int) {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(ms), timescale: 1000))
}

let start = frames[0].ms
var lastMs = -1
var lastBuffer: CVPixelBuffer?
for frame in frames {
  let ms = max(frame.ms - start, lastMs + 1)
  autoreleasepool {
    let buffer = pixels(load(frame.path))
    append(buffer, ms)
    lastBuffer = buffer
  }
  lastMs = ms
}
if let last = lastBuffer { append(last, max(endMs - start, lastMs + 1)) }

input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { fatalError("writer failed: \(String(describing: writer.error))") }
print("Wrote \(frames.count) frames, \(Double(max(endMs - start, lastMs)) / 1000)s")
