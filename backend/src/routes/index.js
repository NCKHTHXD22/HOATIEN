const router = require("express").Router();

router.use("/auth",       require("./auth.routes"));
router.use("/villages",   require("./village.routes"));
router.use("/households", require("./household.routes"));
router.use("/members",    require("./member.routes"));
router.use("/movements",  require("./movement.routes"));
router.use("/reports",    require("./report.routes"));
router.use("/zalo",       require("./zalo.routes"));
router.use("/notify",     require("./notification.routes"));
router.use("/broadcast",  require("./broadcast"));
router.use("/feedbacks",  require("./feedback.routes"));
router.use("/categories", require("./category.routes"));

module.exports = router;
