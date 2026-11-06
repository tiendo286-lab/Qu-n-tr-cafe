from __future__ import annotations

APP_NAME = "QUẢN TRỊ LỊCH LÀM HỆ THỐNG CAFE"
APP_VERSION = "Bản chính thức offline 1.7.6 — Chuyển dữ liệu Mac/Windows qua ZIP"

# Dữ liệu mặc định chỉ dùng để khởi tạo database mới. Sau khi khởi tạo,
# danh sách cơ sở và ca được đọc trực tiếp từ SQLite.
BRANCHES = [
    ("LHP", "LHP", "Lê Hồng Phong"),
    ("DK", "ĐK", "Đông Khê"),
    ("HS", "HS", "Hồ Sen"),
    ("LL", "LL", "LELA"),
]

DEFAULT_SHIFTS = [
    ("S", "Sáng", "#DBEAFE"),
    ("C", "Chiều", "#FEF3C7"),
    ("T", "Tối", "#EDE9FE"),
]

RANKS = ["Quản lý", "Cấp 1", "Cấp 2", "Thử việc"]
EMPLOYEE_STATUSES = ["Đang làm", "Ngừng làm"]
SHIFTS = [item[1] for item in DEFAULT_SHIFTS]  # fallback cho dữ liệu cũ
ROLES = ["Pha chế", "Chạy bàn"]
ORDER_STATUSES = ["ĐI LÀM ĐƯỢC", "NGHỈ"]
WEEKDAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]

ORDER_HEADERS = [
    "Mã NV",
    "Tên nhân viên",
]
for day in WEEKDAY_NAMES:
    for shift in SHIFTS:
        ORDER_HEADERS.append(f"{day.upper()} [CA {shift.upper()}]")

EMPLOYEE_IMPORT_HEADERS = [
    "Mã NV",
    "Tên nhân viên",
    "Phân cấp",
    "Trạng thái",
    "Cơ sở làm việc",
    "Vị trí đảm nhiệm",
]


EVALUATION_CRITERIA = {
    "Pha chế": [
        ("PC001", "Đi làm đúng giờ"),
        ("PC002", "Trang phục/đồng phục đúng quy định"),
        ("PC003", "Giữ vệ sinh quầy, sắp xếp gọn gàng"),
        ("PC004", "An toàn vệ sinh thực phẩm"),
        ("PC005", "Thái độ chuyên nghiệp, không làm việc riêng"),
        ("PC006", "Định lượng đúng theo công thức"),
        ("PC007", "Tuân thủ quy trình pha chế"),
        ("PC008", "Hương vị ổn định giữa các ly"),
        ("PC009", "Trình bày, hình thức đồ uống"),
        ("PC010", "Kiểm soát nguyên liệu, giảm hao hụt/hủy"),
        ("PC011", "Sử dụng & bảo quản máy móc đúng cách"),
        ("PC012", "Hoàn thành order đúng tiến độ"),
        ("PC013", "Chủ động trong công việc (tự giác, không cần nhắc)"),
        ("PC014", "Hỗ trợ khi ca thiếu người/tăng ca linh hoạt"),
        ("PC015", "Phối hợp tốt với thu ngân/chạy bàn"),
        ("PC016", "Xử lý tốt khi đông khách"),
        ("PC017", "Tham gia đào tạo/huấn luyện NV mới"),
        ("PC018", "Đề xuất cải tiến quy trình/sản phẩm"),
        ("PC019", "Phản hồi tốt từ khách/QL"),
        ("PC020", "Điểm thưởng đóng góp/tháng"),
    ],
    "Chạy bàn": [
        ("CB001", "Đi làm đúng giờ"),
        ("CB002", "Trang phục/đồng phục sạch sẽ, gọn gàng"),
        ("CB003", "Chào khách, giao tiếp lễ phép, niềm nở"),
        ("CB004", "Tác phong chuyên nghiệp, không làm việc riêng"),
        ("CB005", "Hỗ trợ khi ca thiếu người/tăng ca linh hoạt"),
        ("CB006", "Chủ động trong công việc (tự giác, không cần nhắc)"),
        ("CB007", "Tiếp nhận order chính xác"),
        ("CB008", "Phục vụ nhanh"),
        ("CB009", "Giữ vệ sinh, bày trí bàn ghế gọn gàng"),
        ("CB010", "Theo dõi, đáp ứng yêu cầu khách kịp thời"),
        ("CB011", "Giao đồ đúng, không nhầm order"),
        ("CB012", "Xử lý khiếu nại/tình huống linh hoạt"),
        ("CB013", "Upsell/giới thiệu món"),
        ("CB014", "Phối hợp nhịp nhàng với Bar & Thu ngân"),
        ("CB015", "Tuân thủ quy trình làm việc nhóm"),
        ("CB016", "Xử lý tốt khi đông khách"),
        ("CB017", "Tham gia đào tạo/huấn luyện NV mới"),
        ("CB018", "Sử dụng thành thạo phần mềm nắm rõ quy trình làm việc"),
        ("CB019", "Phản hồi tốt từ khách/QL"),
        ("CB020", "Điểm thưởng đóng góp/tháng"),
    ],
}

EVALUATION_RATING_THRESHOLDS = [
    (91, "Xuất sắc"),
    (80, "Tốt"),
    (65, "Khá"),
    (50, "Trung bình"),
    (0, "Yếu"),
]
