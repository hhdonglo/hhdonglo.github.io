# Academic memory foundations

Review the three Milestone 4 slices independently.

## 4A. Records and events

`records.js` reads attendance sessions, check-ins, quiz rounds, live answers and quiz result rows through the existing backend. Domain keys produce stable IDs within each course. Held and released quiz results share their ID and change provenance when released. Each projection includes its course, type, source table, source key and date when the source provides one. Attendance uses session-open time for events. Quiz rounds use the earliest stored result or the current control update time. Individual live answers are represented while their source rows exist. The result retains its own stable ID across hold and release. The projection does not reconstruct deleted answers or rounds, or infer missing dates. Disabled modules are omitted from the projection.

## 4B. Links and tags

`log.js` keeps typed links, tags, documents and discussions in a versioned property inside the course's sealed database. Existing automatic and portable workbook backups include that property. Typed links may connect local projected records, events, documents and discussions, and may refer to other course workspaces by registry ID. These cross-course references expose workspace labels only. Workspace references bind the registry ID to its creation marker so restoring a backup cannot silently link to another workspace with the same ID. Older references without that marker are preserved and shown as unavailable until relinked. A link to an archived target is marked archived. A missing or hidden target is marked unavailable, and its identifier remains available for recovery. New links require two available targets. Target tags are owned by the current workspace. Tags are Unicode-normalized, lowercased, trimmed, whitespace-collapsed and deduplicated. Tags and links to unavailable targets can be removed from the owning log.

## 4C. Local index and discussions

Open **Academic memory** from desktop CM. There is one discussion log per course, with notes, decisions, action items, tags and file attachments. Files are referenced relative to the course materials root and checked again when opened. A different root requires linking the file again so a matching filename cannot resolve to the wrong file. Linking an existing file does not copy it.

The shared `academic-index.cmv` in the CM profile is a sealed, rebuildable index. It stores course metadata, generic event labels and only discussions opted into search, along with the filenames of their available attachments. It does not index roster entries, individual results or file bodies. Search is explicitly scoped to the selected course and rebuilds its portion from source before returning references. At launch CM rebuilds the metadata buckets from the registry, prunes stale or archived buckets, and rebuilds records for the course it opens. Other courses reconcile as they open, without starting unrelated course services just to index them. **Refresh index** forces a rebuild even if the index was deleted or replaced during the current session. Archive removes the course's index bucket. Only sealed index files are accepted. The course page keeps its own scope. The Academic Work command bar supports explicit cross-workspace search over approved source entries. File watching is deferred.

**View source** resolves the result in the current course. Workspace results show registry metadata, events show their source table and key, discussions open the live note, and document results open the original linked file. A result whose source was removed, archived or hidden is refused even if the search results were already on screen.

Automated tests cover the three individual slices in `test/academic-memory.test.js`, and the one-instance desktop pilot covers authenticated IPC and cross-course search isolation.
