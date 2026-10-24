<?php
// RFC 9728 section 3.1 - protected-resource metadata for path-suffixed
// resource URIs. The rewrite rule passes the resource path as ?p=<suffix>
// because REQUEST_URI is rewritten before PHP sees it.
$p = $_GET['p'] ?? '';
$suffix = preg_match('#^[a-zA-Z0-9._~/-]+$#', $p) ? '/' . trim($p, '/') : '';
header('Content-Type: application/json');
header('Cache-Control: public, max-age=300');
echo json_encode([
    'resource' => 'https://cloud.cloudless.gr' . $suffix,
    'authorization_servers' => ['https://cloud.cloudless.gr'],
    'scopes_supported' => ['read', 'write', 'admin'],
    'bearer_methods_supported' => ['header'],
    'resource_documentation' => 'https://cloud.cloudless.gr/auth.md',
], JSON_UNESCAPED_SLASHES);
