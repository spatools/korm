export var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export var validGuid1 = "01234567-89AB-CDEF-0123-456789abcdef";
export var validGuid2 = "00000000-0000-0000-0000-000000000000";

export var invalidGuid1 = "abcdefgh-ijkl-mnop-qrst-uvwxyzabcdefg";
export var invalidGuid2 = "012345-6789AB-CDEF-0123-456789ABCDEF";

export var validTempGuid1 = "00000000-0000-0000-0000-123456789012";
export var validTempGuid2 = "00000000-0000-0000-0000-000000000000";

export var invalidTempGuid1 = "00000000-0000-0000-0000-uvwxyzabcdefg";
export var invalidTempGuid2 = "00000000-0000-0000-1111-123456789012";
