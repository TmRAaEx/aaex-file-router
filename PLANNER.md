# 1. File scanning
    Scans the end users pages folder (or specified folder)

# 2. Route builder
    Uses the file scanner to convert files into route objects 
    simple "url-path" : "file-path-relative-to-user"
    advanced {
        "url--path": "file-path",
        "isIndex": bool,
        "isError": bool,
        "isLayout": bool,
        "children": RouteObject[]
    }

# 3. Vite plugin 
    Plugin that builds routes dynamically when files get added or removed from the pages directory