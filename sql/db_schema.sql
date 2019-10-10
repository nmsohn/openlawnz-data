CREATE DATABASE  IF NOT EXISTS `cases` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `cases`;
-- MySQL dump 10.13  Distrib 8.0.13, for Win64 (x86_64)
--
-- Host: localhost    Database: cases
-- ------------------------------------------------------
-- Server version	8.0.13

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
 SET NAMES utf8 ;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `case_citations`
--

DROP TABLE IF EXISTS `case_citations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `case_citations` (
  `case_id` int(11) NOT NULL,
  `citation` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`case_id`,`citation`),
  FULLTEXT KEY `case_citations_index` (`citation`),
  CONSTRAINT `citations_case_id_fk` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `case_errors`
--

DROP TABLE IF EXISTS `case_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `case_errors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cases_array` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `case_pdf`
--

DROP TABLE IF EXISTS `case_pdf`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `case_pdf` (
  `pdf_id` int(11) NOT NULL AUTO_INCREMENT,
  `fetch_date` date DEFAULT NULL,
  `pdf_provider` varchar(45) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `pdf_db_key` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `pdf_url` varchar(2083) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `pdf_sha256` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`pdf_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2050 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cases`
--

DROP TABLE IF EXISTS `cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `cases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `case_date` date DEFAULT NULL,
  `case_text` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `case_name` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `case_footnotes` text COLLATE utf8mb4_unicode_ci,
  `case_footnote_contexts` text COLLATE utf8mb4_unicode_ci,
  `pdf_id` int(11) DEFAULT NULL,
  `pdf_to_text_engine` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `case_footnotes_being_processed` tinyint(4) DEFAULT NULL,
  `case_footnotes_is_valid` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cases_pdf_id_fk_idx` (`pdf_id`),
  FULLTEXT KEY `idx_cases_case_text` (`case_text`) COMMENT '''Fulltext Index to search for substrings efficiently''',
  FULLTEXT KEY `case_text_fulltext_index` (`case_text`) COMMENT '''A fulltext index on case_text to allow the searching of citations efficiently.''',
  CONSTRAINT `cases_pdf_id_fk` FOREIGN KEY (`pdf_id`) REFERENCES `case_pdf` (`pdf_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2050 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cases_cited`
--

DROP TABLE IF EXISTS `cases_cited`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `cases_cited` (
  `case_origin` int(11) NOT NULL,
  `case_cited` int(11) NOT NULL,
  `citation_count` int(11) NOT NULL,
  PRIMARY KEY cases_cited_pkey (`case_origin`,`case_cited`),
  KEY `case_id_cited_fk_idx` (`case_cited`),
  CONSTRAINT `case_id_cited_fk` FOREIGN KEY (`case_cited`) REFERENCES `cases` (`id`),
  CONSTRAINT `case_id_origin_fk` FOREIGN KEY (`case_origin`) REFERENCES `cases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `legislation`
--

DROP TABLE IF EXISTS `legislation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `legislation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alerts` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1681 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `legislation_to_cases`
--

DROP TABLE IF EXISTS `legislation_to_cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `legislation_to_cases` (
  `legislation_id` int(11) NOT NULL,
  `section` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `case_id` int(11) NOT NULL,
  `count` int(11) DEFAULT NULL,
  PRIMARY KEY (`legislation_id`,`case_id`,`section`),
  KEY `id_idx` (`legislation_id`),
  KEY `id_idx1` (`case_id`),
  CONSTRAINT `legislation_id_fk` FOREIGN KEY (`legislation_id`) REFERENCES `legislation` (`id`),
  CONSTRAINT `legislation_to_cases_case_id_fk` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-03-06 21:51:02
