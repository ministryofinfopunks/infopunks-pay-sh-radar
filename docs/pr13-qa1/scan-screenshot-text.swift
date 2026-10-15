import Foundation
import Vision
import AppKit
import CryptoKit
let root = URL(fileURLWithPath: "/tmp/radar-pr13-qa1")
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("docs/pr13-qa1/frozen-artifact-manifest.json"))) as! [String:Any]
let files = manifest["files"] as! [[String:Any]]
var reports = [[String:Any]]()
var cache = [String:[String:Any]]()
let patterns = ["private_key":"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "provider_token":"\\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk-(proj-)?[A-Za-z0-9_-]{24,})", "email":"\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", "credential_label":"(tenant access key|bearer |password|private key|api key|secret)"]
for file in files where (file["path"] as! String).hasSuffix(".png") {
 let path=file["path"] as! String;let sha=file["sha256"] as! String
 var report:[String:Any]
 if let prior=cache[sha] { report=prior;report["reused_identical_pixels"]=true }
 else {
  do {
   let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false
   let handler=VNImageRequestHandler(url:root.appendingPathComponent(path));try handler.perform([request])
   let lines=(request.results ?? []).compactMap{$0.topCandidates(1).first?.string};let text=lines.joined(separator:"\n")
   var hits=[[String:Any]]()
   for (kind,pattern) in patterns {
    let regex=try NSRegularExpression(pattern:pattern,options:[.caseInsensitive]);let range=NSRange(text.startIndex..<text.endIndex,in:text)
    for match in regex.matches(in:text,range:range) {let s=(text as NSString).substring(with:match.range);hits.append(["kind":kind,"match_sha256":SHA256.hash(data:Data(s.utf8)).map{String(format:"%02x",$0)}.joined()])}
   }
   report=["ocr_completed":true,"recognized_lines":lines.count,"text_sha256":SHA256.hash(data:Data(text.utf8)).map{String(format:"%02x",$0)}.joined(),"hits":hits]
  } catch {report=["ocr_completed":false,"error":error.localizedDescription]}
  cache[sha]=report
 }
 report["path"]=path;report["image_sha256"]=sha;reports.append(report)
 if reports.count % 25 == 0 {print("OCR \(reports.count) screenshots");fflush(stdout)}
 let output:[String:Any] = ["method":"Local Apple Vision OCR accurate; identical SHA256 files reuse recognized text. Potential matches hashed, never copied. OCR cannot prove absence of secrets or qualify human privacy review.","source_sha":"e1b7e7be2f14056c5aed61484b0fb1ba371be4a6","reports":reports]
 try JSONSerialization.data(withJSONObject:output,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("docs/pr13-qa1/screenshot-text-scan.json"))
}
print("OCR completed \(reports.count) screenshots / \(cache.count) unique files")
