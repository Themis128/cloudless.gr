<?php
// RFC 9728 §3.1 — protected-resource metadata for path-suffixed resource URIs.
// Emits the same metadata as the root document with `resource` matching the
// requested protected resource path.
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$suffix = '';
if (preg_match('#^/\.well-known/oauth-protected-resource(/[a-zA-Z0-9._~/-]*)#', $uri, $m)) {
    $suffix = rtrim($m[1], '/');
}
header('Content-Type: application/json');
header('Cache-Control: public, max-age=300');
echo json_encode([
    'resource' => 'https://cloud.cloudless.gr' . $suffix,
    'authorization_servers' => ['https://cloud.cloudless.gr'],
    'scopes_supported' => ['read', 'write', 'admin'],
    'bearer_methods_supported' => ['header'],
    'resource_documentation' => 'https://cloud.cloudless.gr/auth.md',
], JSON_UNESCAPED_SLASHES);
